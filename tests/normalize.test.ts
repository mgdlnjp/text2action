import { describe, expect, it } from "vitest";
import {
  InvalidOutputError,
  normalizeExtraction,
  parseModelJson,
} from "../shared/normalize";
import { EXTRACTION_JSON_SCHEMA, RawTaskSchema, type RawTask } from "../shared/schema";

const SOURCE = `Bonjour,
Marie doit envoyer le devis au client avant vendredi.
Quelqu'un doit relancer le fournisseur.
On pourrait peut-être refaire la maquette.
Le budget a été validé.`;

let n = 0;
const makeId = () => `t${++n}`;

function raw(partial: Partial<RawTask>): RawTask {
  return {
    title: "Envoyer le devis",
    description: null,
    owner: null,
    dueText: null,
    dueDate: null,
    dueIsCertain: false,
    priority: "medium",
    priorityIsExplicit: false,
    confidence: "high",
    needsConfirmation: false,
    confirmationReason: null,
    isDone: false,
    sourceExcerpt: "Marie doit envoyer le devis au client avant vendredi.",
    ...partial,
  };
}

function run(tasks: unknown[], noTaskReason: string | null = null, source = SOURCE) {
  return normalizeExtraction({ tasks, noTaskReason }, source, { mode: "ai", makeId });
}

describe("cas sans tâche", () => {
  it("renvoie une liste vide et la raison fournie, sans fabriquer de tâche", () => {
    const result = run([], "Le texte ne contient que des informations.");
    expect(result.tasks).toEqual([]);
    expect(result.noTaskReason).toBe("Le texte ne contient que des informations.");
    expect(result.warnings).toEqual([]);
  });

  it("fournit une raison par défaut si le modèle n'en donne pas", () => {
    const result = run([], null);
    expect(result.tasks).toHaveLength(0);
    expect(result.noTaskReason).toMatch(/aucune action/i);
  });

  it("n'a pas de noTaskReason quand des tâches existent", () => {
    expect(run([raw({})], "ignoré").noTaskReason).toBeNull();
  });
});

describe("dates absentes ou incertaines", () => {
  it("laisse l'échéance vide quand le texte n'en donne pas", () => {
    const [task] = run([raw({ dueText: null, dueDate: null, dueIsCertain: true })]).tasks;
    expect(task!.dueText).toBeNull();
    expect(task!.dueDate).toBeNull();
    expect(task!.dueIsCertain).toBe(false);
  });

  it("retire une échéance inventée (absente du texte)", () => {
    const [task] = run([raw({ dueText: "le 30 juin", dueDate: "2026-06-30", dueIsCertain: true })]).tasks;
    expect(task!.dueText).toBeNull();
    expect(task!.dueDate).toBeNull();
    expect(task!.dueIsCertain).toBe(false);
    expect(task!.needsConfirmation).toBe(true);
    expect(task!.confirmationReasons.join()).toMatch(/échéance proposée absente/i);
  });

  it("ne garde pas une date ISO calculée depuis une expression relative", () => {
    const [task] = run([raw({ dueText: "avant vendredi", dueDate: "2026-11-13", dueIsCertain: true })]).tasks;
    expect(task!.dueText).toBe("avant vendredi");
    expect(task!.dueDate).toBeNull();
  });

  it("garde la date ISO si l'année est écrite dans le texte", () => {
    const source = "Merci d'envoyer le rapport d'ici le 12 mars 2026.";
    const [task] = run(
      [raw({ dueText: "d'ici le 12 mars 2026", dueDate: "2026-03-12", dueIsCertain: true, sourceExcerpt: source })],
      null,
      source,
    ).tasks;
    expect(task!.dueDate).toBe("2026-03-12");
    expect(task!.dueIsCertain).toBe(true);
  });

  it("rejette une date ISO invalide", () => {
    const source = "Merci d'envoyer le rapport le 31/02/2026.";
    const [task] = run(
      [raw({ dueText: "le 31/02/2026", dueDate: "2026-02-31", dueIsCertain: true, sourceExcerpt: source })],
      null,
      source,
    ).tasks;
    expect(task!.dueDate).toBeNull();
  });

  it("marque les échéances vagues comme non confirmées", () => {
    const source = "Il faut relancer le client rapidement.";
    const [task] = run(
      [raw({ dueText: "rapidement", dueIsCertain: true, sourceExcerpt: source })],
      null,
      source,
    ).tasks;
    expect(task!.dueText).toBe("rapidement");
    expect(task!.dueIsCertain).toBe(false);
    expect(task!.needsConfirmation).toBe(true);
  });
});

describe("responsables ambigus ou inventés", () => {
  it("conserve un responsable explicitement nommé", () => {
    const [task] = run([raw({ owner: "Marie" })]).tasks;
    expect(task!.owner).toBe("Marie");
  });

  it("retire un responsable vague et demande confirmation", () => {
    const [task] = run([
      raw({ title: "Relancer le fournisseur", owner: "Quelqu'un", sourceExcerpt: "Quelqu'un doit relancer le fournisseur." }),
    ]).tasks;
    expect(task!.owner).toBeNull();
    expect(task!.needsConfirmation).toBe(true);
    expect(task!.confirmationReasons.join()).toMatch(/ambigu/i);
  });

  it("retire un responsable absent du texte", () => {
    const [task] = run([raw({ owner: "Bertrand" })]).tasks;
    expect(task!.owner).toBeNull();
    expect(task!.confirmationReasons.join()).toMatch(/absent du texte/i);
  });

  it("vérifie chaque nom d'un responsable multiple", () => {
    const [task] = run([raw({ owner: "Marie et Paul" })]).tasks;
    expect(task!.owner).toBeNull();
  });

  it("signale des responsables différents lors d'une fusion de doublons", () => {
    const source = "Marie doit envoyer le devis. Paul doit envoyer le devis.";
    const result = run(
      [
        raw({ owner: "Marie", sourceExcerpt: "Marie doit envoyer le devis." }),
        raw({ owner: "Paul", sourceExcerpt: "Paul doit envoyer le devis." }),
      ],
      null,
      source,
    );
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.owner).toBeNull();
    expect(result.tasks[0]!.confirmationReasons.join()).toMatch(/Marie \/ Paul/);
  });
});

describe("prudence générale", () => {
  it("signale une formulation hypothétique", () => {
    const [task] = run([
      raw({ title: "Refaire la maquette", sourceExcerpt: "On pourrait peut-être refaire la maquette." }),
    ]).tasks;
    expect(task!.needsConfirmation).toBe(true);
    expect(task!.confirmationReasons.join()).toMatch(/hypothétique/i);
  });

  it("ne traite pas une simple question polie comme une hypothèse", () => {
    const source = "Peux-tu envoyer le devis ?";
    const [task] = run([raw({ sourceExcerpt: source })], null, source).tasks;
    expect(task!.needsConfirmation).toBe(false);
  });

  it("baisse la confiance si l'extrait source est introuvable", () => {
    const [task] = run([raw({ sourceExcerpt: "Texte qui n'existe pas dans la source" })]).tasks;
    expect(task!.confidence).toBe("low");
    expect(task!.needsConfirmation).toBe(true);
  });

  it("accepte un extrait coupé par une ellipse", () => {
    const [task] = run([raw({ sourceExcerpt: "Marie doit envoyer … avant vendredi." })]).tasks;
    expect(task!.confidence).toBe("high");
  });

  it("conserve l'état « déjà fait » explicite", () => {
    const [task] = run([raw({ isDone: true })]).tasks;
    expect(task!.done).toBe(true);
    expect(task!.doneInSource).toBe(true);
  });

  it("fusionne les doublons en conservant le contexte", () => {
    const result = run([
      raw({ description: "Version finale" }),
      raw({ title: "Envoyer le devis au client", description: "Avec les conditions", dueText: "avant vendredi", dueIsCertain: true }),
    ]);
    expect(result.tasks).toHaveLength(1);
    const task = result.tasks[0]!;
    expect(task.mentions).toBe(2);
    expect(task.description).toContain("Version finale");
    expect(task.description).toContain("Avec les conditions");
    expect(task.dueText).toBe("avant vendredi");
    expect(result.warnings.join()).toMatch(/doublon/);
  });
});

describe("sorties invalides", () => {
  it("rejette un JSON mal formé", () => {
    expect(() => parseModelJson("{tasks: [")).toThrow(InvalidOutputError);
    expect(() => parseModelJson("Voici vos tâches : …")).toThrow(InvalidOutputError);
  });

  it("tolère un bloc ```json", () => {
    expect(parseModelJson('```json\n{"tasks":[],"noTaskReason":null}\n```')).toEqual({ tasks: [], noTaskReason: null });
  });

  it("rejette une enveloppe qui ne respecte pas le schéma", () => {
    expect(() => normalizeExtraction({ items: [] }, SOURCE, { mode: "ai" })).toThrow(InvalidOutputError);
    expect(() => normalizeExtraction(null, SOURCE, { mode: "ai" })).toThrow(InvalidOutputError);
    expect(() => normalizeExtraction({ tasks: "x", noTaskReason: null }, SOURCE, { mode: "ai" })).toThrow(
      InvalidOutputError,
    );
  });

  it("ignore les éléments mal formés et le signale", () => {
    const result = run([raw({}), { title: "Sans les autres champs" }, { ...raw({}), priority: "urgentissime" }]);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings.join()).toMatch(/2 éléments mal formés/);
  });

  it("échoue si aucun élément n'est valide", () => {
    expect(() => run([{ foo: 1 }, { bar: 2 }])).toThrow(InvalidOutputError);
  });
});

describe("schéma JSON envoyé au modèle", () => {
  it("reste aligné avec le schéma Zod", () => {
    const jsonKeys = [...EXTRACTION_JSON_SCHEMA.properties.tasks.items.required].sort();
    const zodKeys = Object.keys(RawTaskSchema.shape).sort();
    expect(jsonKeys).toEqual(zodKeys);
    expect(Object.keys(EXTRACTION_JSON_SCHEMA.properties.tasks.items.properties).sort()).toEqual(zodKeys);
    expect(EXTRACTION_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(EXTRACTION_JSON_SCHEMA.properties.tasks.items.additionalProperties).toBe(false);
  });
});
