import { describe, expect, it } from "vitest";
import { csvCell, dueLabel, priorityLabel, toCsv, toMarkdown, toPlainText } from "../shared/export";
import type { Task } from "../shared/schema";

function task(partial: Partial<Task> = {}): Task {
  return {
    id: "1",
    title: "Envoyer le devis",
    description: null,
    owner: "Marie",
    dueText: "avant vendredi",
    dueDate: null,
    dueIsCertain: true,
    priority: "high",
    priorityIsExplicit: false,
    confidence: "high",
    needsConfirmation: false,
    confirmationReasons: [],
    done: false,
    doneInSource: false,
    sourceExcerpt: "Marie doit envoyer le devis avant vendredi.",
    mentions: 1,
    ...partial,
  };
}

describe("libellés", () => {
  it("ne présente jamais une échéance incertaine comme confirmée", () => {
    expect(dueLabel(task({ dueText: "bientôt", dueIsCertain: false }))).toBe("« bientôt » (à confirmer)");
  });
  it("formate une date confirmée", () => {
    expect(dueLabel(task({ dueText: "le 12/03/2026", dueDate: "2026-03-12" }))).toBe("12 mars 2026");
  });
  it("n'affiche rien sans échéance", () => {
    expect(dueLabel(task({ dueText: null, dueDate: null }))).toBeNull();
  });
  it("mentionne une priorité estimée", () => {
    expect(priorityLabel(task())).toBe("Haute (estimée)");
    expect(priorityLabel(task({ priorityIsExplicit: true }))).toBe("Haute");
  });
});

describe("exports", () => {
  it("copie une liste lisible", () => {
    const text = toPlainText([task(), task({ id: "2", title: "Relancer", done: true, owner: null, dueText: null })]);
    expect(text).toContain("[ ] Envoyer le devis — Responsable : Marie");
    expect(text).toContain("[x] Relancer — Priorité : Haute (estimée)");
  });

  it("exporte en Markdown avec cases à cocher et source", () => {
    const md = toMarkdown([task({ needsConfirmation: true, confirmationReasons: ["Échéance imprécise"] })]);
    expect(md).toContain("- [ ] **Envoyer le devis**");
    expect(md).toContain("Fiabilité : À confirmer");
    expect(md).toContain("Source : > Marie doit envoyer le devis avant vendredi.");
  });

  it("échappe le Markdown injecté dans un titre", () => {
    expect(toMarkdown([task({ title: "Voir [lien](http://x) *gras*" })])).toContain("Voir \\[lien\\](http://x) \\*gras\\*");
  });

  it("produit un CSV avec BOM, séparateur ; et en-têtes", () => {
    const csv = toCsv([task()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header, row] = csv.slice(1).split("\r\n");
    expect(header!.split(";")).toHaveLength(12);
    expect(row).toContain("À faire;Envoyer le devis;;Marie;avant vendredi;;oui;Haute;oui");
  });

  it("échappe guillemets, séparateurs et retours à la ligne", () => {
    expect(csvCell('Dire "bonjour"; puis\npartir')).toBe('"Dire ""bonjour""; puis\npartir"');
  });

  it("neutralise les formules de tableur", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toMatch(/^"?'=/);
    expect(csvCell("+33 6")).toBe("'+33 6");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
});
