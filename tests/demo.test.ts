import { describe, expect, it } from "vitest";
import { extractDemo } from "../server/ai/demo";
import { normalizeExtraction } from "../shared/normalize";
import { SAMPLES } from "../src/lib/samples";

function extract(text: string) {
  return normalizeExtraction(extractDemo(text), text, { mode: "demo" });
}

describe("extracteur du mode démo", () => {
  it("ne fabrique aucune tâche à partir d'un texte purement informatif", () => {
    const result = extract(
      "Bonjour,\nLe budget a été validé hier. La réunion s'est bien passée et le client est satisfait.\nBonne journée.",
    );
    expect(result.tasks).toEqual([]);
    expect(result.noTaskReason).toBeTruthy();
  });

  it("extrait responsable et échéance quand ils sont écrits", () => {
    const [task] = extract("Marie doit envoyer le devis au client avant vendredi.").tasks;
    expect(task!.title).toBe("Envoyer le devis au client");
    expect(task!.owner).toBe("Marie");
    expect(task!.dueText).toBe("avant vendredi");
    expect(task!.dueDate).toBeNull();
  });

  it("n'invente ni date ni responsable", () => {
    const [task] = extract("Il faut mettre à jour la documentation technique.").tasks;
    expect(task!.owner).toBeNull();
    expect(task!.dueText).toBeNull();
    expect(task!.dueDate).toBeNull();
  });

  it("n'attribue pas « Quelqu'un » comme responsable", () => {
    const [task] = extract("Quelqu'un doit contacter le support au sujet des tickets.").tasks;
    expect(task!.owner).toBeNull();
  });

  it("convertit en ISO uniquement les dates complètes", () => {
    const [task] = extract("Thomas : mettre à jour le planning d'ici le 15/04/2026.").tasks;
    expect(task!.owner).toBe("Thomas");
    expect(task!.dueDate).toBe("2026-04-15");
  });

  it("repère une tâche déjà terminée", () => {
    const [task] = extract("- [x] Envoyer le compte rendu aux participants").tasks;
    expect(task!.done).toBe(true);
  });

  it("garde une hypothèse au statut « à confirmer »", () => {
    const [task] = extract("On pourrait peut-être organiser un webinar.").tasks;
    expect(task!.needsConfirmation).toBe(true);
    expect(task!.confidence).toBe("low");
  });

  it("lit la priorité explicite dans la phrase suivante", () => {
    const [task] = extract("Peux-tu relancer l'imprimeur ? C'est urgent.").tasks;
    expect(task!.priority).toBe("high");
    expect(task!.priorityIsExplicit).toBe(true);
  });

  it("produit des tâches valides pour chaque exemple fourni", () => {
    for (const sample of Object.values(SAMPLES)) {
      const result = extract(sample);
      expect(result.tasks.length).toBeGreaterThan(0);
      for (const task of result.tasks) {
        expect(task.title.length).toBeGreaterThan(2);
        // Chaque extrait doit être retrouvable : sinon la normalisation le signale.
        expect(task.confirmationReasons).not.toContain("Extrait source non retrouvé tel quel dans le texte");
        if (task.owner) expect(sample).toContain(task.owner);
      }
    }
  });
});
