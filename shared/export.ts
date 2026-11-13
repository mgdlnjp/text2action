import type { Confidence, Priority, Task } from "./schema";

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Élevée",
  medium: "Moyenne",
  low: "Faible",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatIsoDate(iso: string): string {
  return dateFormatter.format(new Date(`${iso}T00:00:00Z`));
}

/** Libellé lisible d'une échéance, qui n'affirme jamais une date incertaine. */
export function dueLabel(task: Pick<Task, "dueText" | "dueDate" | "dueIsCertain">): string | null {
  if (!task.dueText) return null;
  if (task.dueIsCertain && task.dueDate) return formatIsoDate(task.dueDate);
  if (task.dueIsCertain) return task.dueText;
  return `« ${task.dueText} » (à confirmer)`;
}

export function priorityLabel(task: Pick<Task, "priority" | "priorityIsExplicit">): string {
  return `${PRIORITY_LABELS[task.priority]}${task.priorityIsExplicit ? "" : " (estimée)"}`;
}

function confirmationLabel(task: Task): string {
  return task.needsConfirmation ? "À confirmer" : CONFIDENCE_LABELS[task.confidence];
}

/* ------------------------------------------------------------------ */
/*  Texte brut (presse-papiers)                                        */
/* ------------------------------------------------------------------ */

export function toPlainText(tasks: Task[]): string {
  return tasks
    .map((t) => {
      const meta = [
        t.owner ? `Responsable : ${t.owner}` : null,
        dueLabel(t) ? `Échéance : ${dueLabel(t)}` : null,
        `Priorité : ${priorityLabel(t)}`,
        t.needsConfirmation ? "À confirmer" : null,
      ].filter(Boolean);
      return `${t.done ? "[x]" : "[ ]"} ${t.title}${meta.length ? ` — ${meta.join(" · ")}` : ""}`;
    })
    .join("\n");
}

/* ------------------------------------------------------------------ */
/*  Markdown                                                           */
/* ------------------------------------------------------------------ */

function mdEscape(value: string): string {
  return value.replace(/([\\`*_[\]<>|])/g, "\\$1");
}

export function toMarkdown(tasks: Task[], generatedAt = new Date()): string {
  const lines = [
    "# Liste d'actions",
    "",
    `_Générée avec Text2Action le ${generatedAt.toLocaleDateString("fr-FR")} — à vérifier avant usage._`,
    "",
  ];
  for (const t of tasks) {
    lines.push(`- [${t.done ? "x" : " "}] **${mdEscape(t.title)}**`);
    if (t.description) lines.push(`  - ${mdEscape(t.description)}`);
    if (t.owner) lines.push(`  - Responsable : ${mdEscape(t.owner)}`);
    const due = dueLabel(t);
    if (due) lines.push(`  - Échéance : ${mdEscape(due)}`);
    lines.push(`  - Priorité : ${priorityLabel(t)}`);
    lines.push(`  - Fiabilité : ${confirmationLabel(t)}`);
    if (t.confirmationReasons.length) {
      lines.push(`  - À vérifier : ${mdEscape(t.confirmationReasons.join(" ; "))}`);
    }
    lines.push(`  - Source : > ${mdEscape(t.sourceExcerpt)}`);
  }
  return `${lines.join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/*  CSV (RFC 4180, séparateur « ; » pour Excel FR)                     */
/* ------------------------------------------------------------------ */

const CSV_HEADERS = [
  "Statut",
  "Titre",
  "Description",
  "Responsable",
  "Échéance (texte)",
  "Échéance (date)",
  "Échéance confirmée",
  "Priorité",
  "Priorité estimée",
  "Fiabilité",
  "Points à vérifier",
  "Extrait source",
];

export function csvCell(value: string | number | boolean | null): string {
  if (value == null) return "";
  let s = String(value);
  // Neutralise l'injection de formules dans les tableurs.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(tasks: Task[]): string {
  const rows = tasks.map((t) =>
    [
      t.done ? "Terminée" : "À faire",
      t.title,
      t.description,
      t.owner,
      t.dueText,
      t.dueIsCertain ? t.dueDate : null,
      t.dueText ? (t.dueIsCertain ? "oui" : "non") : null,
      PRIORITY_LABELS[t.priority],
      t.priorityIsExplicit ? "non" : "oui",
      confirmationLabel(t),
      t.confirmationReasons.join(" ; "),
      t.sourceExcerpt,
    ]
      .map(csvCell)
      .join(";"),
  );
  // BOM pour qu'Excel détecte l'UTF-8.
  return `\uFEFF${[CSV_HEADERS.map(csvCell).join(";"), ...rows].join("\r\n")}\r\n`;
}
