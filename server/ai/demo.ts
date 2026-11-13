import type { Priority, RawTask } from "../../shared/schema";
import { fold } from "../../shared/text";
import type { Extractor } from "./types";

/**
 * MODE DÉMO — extraction par règles simples, sans appel externe.
 * Volontairement prudent : il préfère manquer une action que d'en inventer une.
 */

const ACTION_TRIGGERS = [
  "merci de",
  "merci d'",
  "peux-tu",
  "peux tu",
  "pourrais-tu",
  "pourrais tu",
  "pouvez-vous",
  "pourriez-vous",
  "il faut",
  "il faudra",
  "il faudrait",
  "a faire",
  "todo",
  "to do",
  "action :",
  "action:",
  "actions :",
  "je vais",
  "je m'occupe",
  "je me charge",
  "je m'en occupe",
  "on doit",
  "doit ",
  "doivent",
  "devra",
  "devez",
  "n'oublie pas",
  "n'oubliez pas",
  "pense a",
  "penser a",
  "pensez a",
  "s'occupe de",
  "se charge de",
  "prochaine etape",
  "relancer",
  "a envoyer",
  "a preparer",
  "a valider",
  "on pourrait",
];

const DONE_MARKERS = /(\[x\]|c'est fait|deja fait|deja envoye|a ete (envoye|fait|valide|regle)|est fait\b|c'est regle|termine\b|\bdone\b|✅|✔)/;

const HYPOTHESIS = /\b(peut-etre|eventuellement|on pourrait|il faudrait|si besoin|si jamais|a voir|pas sur|envisager|pourquoi pas)\b/;

const LABEL_WORDS = new Set(
  [
    "objet", "sujet", "de", "a", "cc", "date", "reunion", "participants", "presents", "note", "notes",
    "ordre du jour", "decision", "decisions", "action", "actions", "todo", "info", "infos", "remarque",
    "ps", "bonjour", "contexte", "resume", "points", "point", "suivi", "prochaines etapes", "important",
  ].map(fold),
);

const MONTHS = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre";
const DAYS = "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";
const MONTH_INDEX = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

const DUE_REGEX = new RegExp(
  [
    `(?:avant|d'ici|pour|au plus tard|jusqu'au|d'ici au|d'ici à|à rendre)\\s+(?:le\\s+|la\\s+|à\\s+la\\s+)?(?:(?:${DAYS})(?:\\s+prochain)?(?:\\s+\\d{1,2}(?:er)?(?:\\s+(?:${MONTHS}))?)?|\\d{1,2}(?:er)?\\s+(?:${MONTHS})(?:\\s+\\d{4})?|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?|demain|ce soir|midi|fin (?:de|du) (?:la\\s+)?(?:semaine|mois)|la semaine prochaine)`,
    `\\b(?:demain|ce soir|aujourd'hui|cette semaine|dès que possible|asap|rapidement|au plus vite|bientôt)\\b`,
    `\\ble\\s+\\d{1,2}(?:er)?\\s+(?:${MONTHS})(?:\\s+\\d{4})?`,
    `\\ble\\s+\\d{1,2}/\\d{1,2}/\\d{2,4}`,
  ].join("|"),
  "iu",
);

const VAGUE_DUE = /(dès que possible|asap|rapidement|au plus vite|bientôt|cette semaine|fin (?:de|du))/iu;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Date ISO uniquement si l'année est écrite dans le texte. */
function absoluteIso(dueText: string): string | null {
  const numeric = dueText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numeric) return `${numeric[3]}-${pad(Number(numeric[2]))}-${pad(Number(numeric[1]))}`;
  const named = fold(dueText).match(new RegExp(`(\\d{1,2})(?:er)?\\s+(${MONTH_INDEX.join("|")})\\s+(\\d{4})`));
  if (named) {
    const month = MONTH_INDEX.indexOf(named[2]!) + 1;
    return `${named[3]}-${pad(month)}-${pad(Number(named[1]))}`;
  }
  return null;
}

function detectPriority(folded: string): { priority: Priority; explicit: boolean } {
  if (/\b(pas urgent|basse priorite|priorite basse|quand tu peux|a l'occasion|pas prioritaire)\b/.test(folded)) {
    return { priority: "low", explicit: true };
  }
  if (/\b(urgent|urgence|prioritaire|priorite haute|haute priorite|critique|asap|au plus vite|bloquant)\b/.test(folded)) {
    return { priority: "high", explicit: true };
  }
  if (/\b(demain|ce soir|aujourd'hui)\b/.test(folded)) return { priority: "high", explicit: false };
  return { priority: "medium", explicit: false };
}

const NAME = "\\p{Lu}[\\p{L}'-]+(?:\\s\\p{Lu}[\\p{L}'-]+)?";

function detectOwner(sentence: string, lineOwner: string | null): string | null {
  const mention = sentence.match(new RegExp(`@(${NAME})`, "u"));
  if (mention) return mention[1]!;
  const subject = sentence.match(
    new RegExp(`(?:^|[.;,:]\\s*|\\s)(${NAME})\\s+(?:doit|devra|va|s'occupe|se charge|enverra|prépare|préparera|envoie|relance|contacte|s'engage)\\b`, "u"),
  );
  if (subject && !LABEL_WORDS.has(fold(subject[1]!)) && !/^(Il|On|Je|Tu|Nous|Vous|Elle|Ils|Elles)$/.test(subject[1]!)) {
    return subject[1]!;
  }
  const vocative = sentence.match(new RegExp(`^(${NAME})\\s*,\\s*(?:peux|pourrais|merci|tu|n'oublie)`, "u"));
  if (vocative) return vocative[1]!;
  const thanks = sentence.match(new RegExp(`merci\\s+(${NAME})\\s+d[e']`, "iu"));
  if (thanks && /^\p{Lu}/u.test(thanks[1]!)) return thanks[1]!;
  return lineOwner;
}

const LEAD_INS = [
  /^(?:[-*•]\s*)?(?:\[[ x]\]\s*)?/i,
  /^(?:action|actions|todo|to do|à faire|a faire)\s*:\s*/i,
  /^(?:merci\s+(?:\p{Lu}[\p{L}'-]+\s+)?d[e']\s*|peux-tu\s+|peux tu\s+|pourrais-tu\s+|pourrais tu\s+|pouvez-vous\s+|pourriez-vous\s+|il faut\s+(?:que\s+)?|il faudra\s+|il faudrait\s+|on doit\s+|peut-être\s+|n'oublie(?:z)? pas\s+d[e']\s*|pense(?:z|r)? à\s+|je vais\s+|je m'occupe\s+d[e']\s*|je me charge\s+d[e']\s*|on pourrait\s+)/iu,
];

function deriveTitle(sentence: string, owner: string | null, dueText: string | null): string {
  let t = sentence.trim().replace(/^(?:[-*•]\s*)?(?:\[[ x]\]\s*)?/i, "");
  if (owner) {
    t = t.replace(new RegExp(`^@?${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,:]?\\s*`, "u"), "");
    t = t.replace(new RegExp(`@${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "u"), "");
    t = t.replace(/^(?:doit|devra|va|s'occupe d[e']|se charge d[e'])\s*/iu, "");
  }
  for (const re of LEAD_INS) t = t.replace(re, "");
  t = t
    .replace(/^peut-être\s+/iu, "")
    .replace(/^(?:aussi|également|donc|ensuite|enfin)\s+/iu, "")
    .replace(/,?\s*(?:c'est\s+)?(?:urgent|important|prioritaire|à voir|à discuter|si possible|pas urgent)\s*[.!?]*$/iu, "");
  if (dueText) t = t.replace(dueText, "");
  t = t
    .replace(/\s+(?:stp|svp|s'il te plaît|s'il vous plaît|merci)\b.*$/iu, "")
    .replace(/[\s,;:.!?]+$/u, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (t.length > 80) t = `${t.slice(0, 80).replace(/\s+\S*$/, "")}…`;
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Action à préciser";
}

function splitSentences(line: string): string[] {
  return line
    .split(/(?<=[.!?])\s+(?=\p{Lu}|@)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractDemo(text: string): { tasks: RawTask[]; noTaskReason: string | null } {
  const tasks: RawTask[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    // « Prénom : … » en début de ligne désigne souvent le responsable.
    let lineOwner: string | null = null;
    let body = line;
    const prefixed = line.match(new RegExp(`^(?:[-*•]\\s*)?(?:\\[[ x]\\]\\s*)?(${NAME})\\s*:\\s*(.+)$`, "u"));
    if (prefixed && !LABEL_WORDS.has(fold(prefixed[1]!))) {
      lineOwner = prefixed[1]!;
      body = prefixed[2]!;
    }
    const isChecklist = /^(?:[-*•]\s*)?\[[ x]\]/i.test(line);
    const isActionLine =
      /^(?:[-*•]\s*)?(?:action|actions|todo|à faire|a faire)\s*:/iu.test(line) ||
      // « Thomas : mettre à jour… » : un nom suivi d'un verbe à l'infinitif.
      (!!lineOwner && /^\p{L}+(?:er|ir|re)\b/iu.test(body.trim()));
    const lineFolded = fold(line);

    for (const sentence of splitSentences(body)) {
      const folded = fold(sentence);
      const triggered =
        isChecklist || isActionLine || ACTION_TRIGGERS.some((trigger) => folded.includes(trigger));
      if (!triggered) continue;
      const isDone = DONE_MARKERS.test(fold(isChecklist ? line : sentence));
      const hypothetical = HYPOTHESIS.test(folded);

      const dueMatch = sentence.match(DUE_REGEX);
      const dueText = dueMatch ? dueMatch[0].trim() : null;
      const owner = detectOwner(sentence, lineOwner);
      const { priority, explicit } = detectPriority(lineFolded);
      const title = deriveTitle(sentence, owner, dueText);
      const dueIsCertain = !!dueText && !VAGUE_DUE.test(dueText) && !hypothetical;

      tasks.push({
        title,
        description: null,
        owner,
        dueText,
        dueDate: dueText ? absoluteIso(dueText) : null,
        dueIsCertain,
        priority,
        priorityIsExplicit: explicit,
        confidence: hypothetical ? "low" : owner ? "high" : "medium",
        needsConfirmation: hypothetical,
        confirmationReason: hypothetical ? "Formulation hypothétique : engagement non confirmé" : null,
        isDone,
        sourceExcerpt: sentence.length > 160 ? `${sentence.slice(0, 157).trimEnd()}…` : sentence,
      });
    }
  }

  return {
    tasks,
    noTaskReason: tasks.length
      ? null
      : "Le texte semble contenir des informations, mais aucune demande ni engagement explicite.",
  };
}

export const demoExtractor: Extractor = async (input) => extractDemo(input.text);
