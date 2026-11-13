import {
  RawExtractionSchema,
  RawTaskSchema,
  type ExtractionMode,
  type ExtractionResult,
  type Priority,
  type RawTask,
  type Task,
} from "./schema";
import { cleanString, containsFolded, excerptFoundIn, fold, truncate } from "./text";

export const MAX_TASKS = 50;

/** Erreur levée quand la sortie du modèle est inexploitable. */
export class InvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOutputError";
  }
}

/** Parse le texte renvoyé par le modèle (tolère des balises ```json). */
export function parseModelJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(stripped);
  } catch {
    throw new InvalidOutputError("La réponse du modèle n'est pas un JSON valide.");
  }
}

/* ------------------------------------------------------------------ */
/*  Règles de prudence                                                 */
/* ------------------------------------------------------------------ */

/** Responsables trop vagues pour être attribués. */
const VAGUE_OWNERS = new Set(
  [
    "quelqu'un",
    "qqn",
    "on",
    "nous",
    "vous",
    "l'equipe",
    "equipe",
    "tout le monde",
    "tous",
    "personne",
    "a definir",
    "tbd",
    "?",
    "someone",
    "inconnu",
    "non precise",
    "non defini",
  ].map(fold),
);

/** Échéances floues : on les garde comme mention, jamais comme date confirmée. */
const VAGUE_DUE =
  /\b(bientot|rapidement|des que possible|asap|prochainement|plus tard|un de ces jours|a un moment|courant|vers|environ|d'ici peu|au plus vite|a voir|fin du mois|debut du mois|semaine prochaine|mois prochain)\b/;

/** Marqueurs d'hypothèse : l'action n'est pas un engagement ferme. */
const HYPOTHESIS =
  /\b(peut-etre|eventuellement|on pourrait|il faudrait peut|si besoin|si jamais|a voir|a discuter|a confirmer|pas sur|sans doute|envisager|idee|pourquoi pas|est-ce qu'on|faut-il)\b/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

/** Une date ISO n'est conservée que si l'année figure dans le texte de l'échéance. */
function isoDateSupportedByText(iso: string, dueText: string): boolean {
  const year = iso.slice(0, 4);
  const shortYear = year.slice(2);
  return (
    dueText.includes(year) || new RegExp(`\\d{1,2}[/.-]\\d{1,2}[/.-]${shortYear}\\b`).test(dueText)
  );
}

function splitOwners(owner: string): string[] {
  return owner
    .split(/,|;|\/|&|\bet\b|\band\b|\+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 };

/* ------------------------------------------------------------------ */
/*  Normalisation d'une tâche                                          */
/* ------------------------------------------------------------------ */

export function normalizeTask(raw: RawTask, source: string, id: string): Task {
  const reasons: string[] = [];
  const modelReason = cleanString(raw.confirmationReason, 200);
  if (modelReason) reasons.push(modelReason);

  // Extrait source : doit être retrouvable dans le texte.
  let excerpt = cleanString(raw.sourceExcerpt, 400) ?? "";
  let confidence = raw.confidence;
  if (!excerptFoundIn(source, excerpt)) {
    reasons.push("Extrait source non retrouvé tel quel dans le texte");
    confidence = "low";
  }
  excerpt = truncate(excerpt, 220);

  // Responsable : uniquement s'il est explicitement présent dans le texte.
  let owner = cleanString(raw.owner, 80);
  if (owner) {
    if (VAGUE_OWNERS.has(fold(owner))) {
      reasons.push(`Responsable ambigu (« ${owner} »)`);
      owner = null;
    } else if (!splitOwners(owner).every((part) => containsFolded(source, part))) {
      reasons.push("Responsable proposé absent du texte : retiré");
      owner = null;
    }
  }

  // Échéance : recopiée du texte, jamais inventée.
  let dueText = cleanString(raw.dueText, 80);
  let dueDate = raw.dueDate && isValidIsoDate(raw.dueDate) ? raw.dueDate : null;
  let dueIsCertain = raw.dueIsCertain;
  if (dueText && !containsFolded(source, dueText)) {
    reasons.push("Échéance proposée absente du texte : retirée");
    dueText = null;
  }
  if (!dueText) {
    dueDate = null;
    dueIsCertain = false;
  } else {
    if (dueDate && !isoDateSupportedByText(dueDate, dueText)) dueDate = null;
    if (VAGUE_DUE.test(fold(dueText))) dueIsCertain = false;
    if (!dueIsCertain) reasons.push("Échéance imprécise");
  }

  // Formulations hypothétiques.
  if (HYPOTHESIS.test(fold(excerpt)) && !reasons.some((r) => /hypoth/i.test(r))) {
    reasons.push("Formulation hypothétique ou question ouverte");
  }

  if (confidence === "low" && reasons.length === 0) reasons.push("Confiance faible");

  const uniqueReasons = [...new Set(reasons)];
  return {
    id,
    title: truncate(cleanString(raw.title, 200) ?? "Action sans titre", 140),
    description: cleanString(raw.description, 500),
    owner,
    dueText,
    dueDate,
    dueIsCertain,
    priority: raw.priority,
    priorityIsExplicit: raw.priorityIsExplicit,
    confidence,
    needsConfirmation: raw.needsConfirmation || uniqueReasons.length > 0,
    confirmationReasons: uniqueReasons,
    done: raw.isDone,
    doneInSource: raw.isDone,
    sourceExcerpt: excerpt,
    mentions: 1,
  };
}

/* ------------------------------------------------------------------ */
/*  Déduplication                                                      */
/* ------------------------------------------------------------------ */

function dedupeKey(title: string): string {
  return fold(title)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\b(le|la|les|l|un|une|des|du|de|d|a|au|aux)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mergeTasks(a: Task, b: Task): Task {
  const descriptions = [a.description, b.description].filter((d): d is string => !!d);
  const description = [...new Set(descriptions)].join(" — ") || null;
  const excerpts = [...new Set([a.sourceExcerpt, b.sourceExcerpt])];
  const owner =
    a.owner && b.owner && fold(a.owner) !== fold(b.owner) ? null : (a.owner ?? b.owner);
  const reasons = [...a.confirmationReasons, ...b.confirmationReasons];
  if (a.owner && b.owner && fold(a.owner) !== fold(b.owner)) {
    reasons.push(`Responsables différents selon les passages (${a.owner} / ${b.owner})`);
  }
  const due = a.dueText ? a : b;
  return {
    ...a,
    description: description ? truncate(description, 500) : null,
    owner,
    dueText: due.dueText,
    dueDate: due.dueDate,
    dueIsCertain: due.dueIsCertain,
    priority: PRIORITY_RANK[b.priority] > PRIORITY_RANK[a.priority] ? b.priority : a.priority,
    priorityIsExplicit: a.priorityIsExplicit || b.priorityIsExplicit,
    confidence: a.confidence === "low" || b.confidence === "low" ? "low" : a.confidence,
    confirmationReasons: [...new Set(reasons)],
    needsConfirmation: a.needsConfirmation || b.needsConfirmation || reasons.length > 0,
    done: a.done || b.done,
    doneInSource: a.doneInSource || b.doneInSource,
    sourceExcerpt: truncate(excerpts.join(" … "), 300),
    mentions: a.mentions + b.mentions,
  };
}

/** Deux titres désignent la même action si l'un prolonge l'autre (« Relancer le fournisseur » / « … pour la livraison »). */
function sameAction(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.split(" ").length >= 2 && long.startsWith(`${short} `);
}

export function dedupeTasks(tasks: Task[]): Task[] {
  const groups: { key: string; task: Task }[] = [];
  for (const task of tasks) {
    const key = dedupeKey(task.title);
    const existing = groups.find((g) => sameAction(g.key, key));
    if (existing) {
      existing.task = mergeTasks(existing.task, task);
      if (key.length > existing.key.length) existing.key = key;
    } else {
      groups.push({ key, task });
    }
  }
  return groups.map((g) => g.task);
}

/* ------------------------------------------------------------------ */
/*  Point d'entrée                                                     */
/* ------------------------------------------------------------------ */

export interface NormalizeOptions {
  mode: ExtractionMode;
  makeId?: () => string;
}

export function normalizeExtraction(
  raw: unknown,
  source: string,
  { mode, makeId = () => crypto.randomUUID() }: NormalizeOptions,
): ExtractionResult {
  const envelope = RawExtractionSchema.safeParse(raw);
  if (!envelope.success) {
    throw new InvalidOutputError("La structure de la réponse ne correspond pas au schéma attendu.");
  }

  const warnings: string[] = [];
  const valid: Task[] = [];
  let rejected = 0;

  for (const item of envelope.data.tasks) {
    const parsed = RawTaskSchema.safeParse(item);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    valid.push(normalizeTask(parsed.data, source, makeId()));
  }

  if (rejected > 0) {
    warnings.push(
      `${rejected} élément${rejected > 1 ? "s" : ""} mal formé${rejected > 1 ? "s" : ""} ignoré${rejected > 1 ? "s" : ""}.`,
    );
  }
  if (envelope.data.tasks.length > 0 && valid.length === 0) {
    throw new InvalidOutputError("Aucune tâche de la réponse n'a passé la validation.");
  }

  let tasks = dedupeTasks(valid);
  if (tasks.length < valid.length) {
    const merged = valid.length - tasks.length;
    warnings.push(`${merged} doublon${merged > 1 ? "s" : ""} fusionné${merged > 1 ? "s" : ""}.`);
  }
  if (tasks.length > MAX_TASKS) {
    warnings.push(`Liste limitée aux ${MAX_TASKS} premières actions.`);
    tasks = tasks.slice(0, MAX_TASKS);
  }

  return {
    mode,
    tasks,
    noTaskReason:
      tasks.length === 0
        ? (cleanString(envelope.data.noTaskReason, 300) ??
          "Aucune action explicite n'a été détectée dans ce texte.")
        : null,
    warnings,
  };
}
