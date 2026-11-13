import { z } from "zod";
import type { AccessInfo } from "./billing";

/* ------------------------------------------------------------------ */
/*  Entrées                                                            */
/* ------------------------------------------------------------------ */

export const SOURCE_TYPES = ["email", "meeting", "notes", "other"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  email: "Email",
  meeting: "Compte rendu de réunion",
  notes: "Notes libres",
  other: "Autre",
};

export const DEFAULT_MAX_TEXT_CHARS = 15_000;
export const MIN_TEXT_CHARS = 20;
export const MAX_CONTEXT_CHARS = 500;

/* ------------------------------------------------------------------ */
/*  Sortie brute attendue du modèle (schéma strict)                    */
/* ------------------------------------------------------------------ */

export const PRIORITIES = ["high", "medium", "low"] as const;
export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];
export type Confidence = (typeof CONFIDENCES)[number];

export const RawTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  owner: z.string().nullable(),
  dueText: z.string().nullable(),
  dueDate: z.string().nullable(),
  dueIsCertain: z.boolean(),
  priority: z.enum(PRIORITIES),
  priorityIsExplicit: z.boolean(),
  confidence: z.enum(CONFIDENCES),
  needsConfirmation: z.boolean(),
  confirmationReason: z.string().nullable(),
  isDone: z.boolean(),
  sourceExcerpt: z.string().min(1),
});
export type RawTask = z.infer<typeof RawTaskSchema>;

export const RawExtractionSchema = z.object({
  tasks: z.array(z.unknown()),
  noTaskReason: z.string().nullable(),
});

const nullableString = { type: ["string", "null"] } as const;

/**
 * JSON Schema envoyé au modèle via `output_config.format`.
 * Doit rester aligné avec `RawTaskSchema` (vérifié par les tests).
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks", "noTaskReason"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "owner",
          "dueText",
          "dueDate",
          "dueIsCertain",
          "priority",
          "priorityIsExplicit",
          "confidence",
          "needsConfirmation",
          "confirmationReason",
          "isDone",
          "sourceExcerpt",
        ],
        properties: {
          title: { type: "string", description: "Titre court commençant par un verbe d'action." },
          description: { ...nullableString, description: "Contexte utile, ou null." },
          owner: {
            ...nullableString,
            description: "Responsable UNIQUEMENT s'il est nommé explicitement dans le texte, sinon null.",
          },
          dueText: {
            ...nullableString,
            description: "Échéance recopiée mot pour mot du texte, sinon null.",
          },
          dueDate: {
            ...nullableString,
            description: "Date ISO YYYY-MM-DD seulement si le texte donne une date calendaire complète, sinon null.",
          },
          dueIsCertain: { type: "boolean" },
          priority: { type: "string", enum: [...PRIORITIES] },
          priorityIsExplicit: { type: "boolean" },
          confidence: { type: "string", enum: [...CONFIDENCES] },
          needsConfirmation: { type: "boolean" },
          confirmationReason: nullableString,
          isDone: { type: "boolean" },
          sourceExcerpt: {
            type: "string",
            description: "Citation exacte et courte (max ~160 caractères) du texte source.",
          },
        },
      },
    },
    noTaskReason: {
      ...nullableString,
      description: "Si aucune tâche : explication courte. Sinon null.",
    },
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Sortie normalisée renvoyée au client                               */
/* ------------------------------------------------------------------ */

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  owner: z.string().nullable(),
  dueText: z.string().nullable(),
  dueDate: z.string().nullable(),
  dueIsCertain: z.boolean(),
  priority: z.enum(PRIORITIES),
  priorityIsExplicit: z.boolean(),
  confidence: z.enum(CONFIDENCES),
  needsConfirmation: z.boolean(),
  confirmationReasons: z.array(z.string()),
  done: z.boolean(),
  doneInSource: z.boolean(),
  sourceExcerpt: z.string(),
  mentions: z.number().int().min(1),
});
export type Task = z.infer<typeof TaskSchema>;

export type ExtractionMode = "ai" | "demo";

export interface ExtractionResult {
  mode: ExtractionMode;
  tasks: Task[];
  noTaskReason: string | null;
  warnings: string[];
  access?: AccessInfo;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface HealthInfo {
  mode: ExtractionMode;
  provider: string | null;
  maxTextChars: number;
}
