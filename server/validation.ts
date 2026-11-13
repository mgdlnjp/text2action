import {
  MAX_CONTEXT_CHARS,
  MIN_TEXT_CHARS,
  SOURCE_TYPES,
  type SourceType,
} from "../shared/schema";

export interface ExtractInput {
  text: string;
  sourceType: SourceType;
  context: string | null;
}

export type ValidationResult =
  | { ok: true; value: ExtractInput }
  | { ok: false; code: string; message: string };

/** Retire les caractères de contrôle invisibles (hors retours à la ligne et tabulations). */
export function sanitizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function validateExtractRequest(body: unknown, maxTextChars: number): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, code: "INVALID_BODY", message: "Requête invalide." };
  }
  const { text, sourceType, context } = body as Record<string, unknown>;

  if (typeof text !== "string") {
    return { ok: false, code: "TEXT_REQUIRED", message: "Le texte à analyser est requis." };
  }
  const clean = sanitizeText(text);
  if (clean.length < MIN_TEXT_CHARS) {
    return {
      ok: false,
      code: "TEXT_TOO_SHORT",
      message: `Le texte est trop court (minimum ${MIN_TEXT_CHARS} caractères).`,
    };
  }
  if (clean.length > maxTextChars) {
    return {
      ok: false,
      code: "TEXT_TOO_LONG",
      message: `Le texte dépasse la limite de ${maxTextChars.toLocaleString("fr-FR")} caractères.`,
    };
  }

  const type = sourceType ?? "other";
  if (typeof type !== "string" || !(SOURCE_TYPES as readonly string[]).includes(type)) {
    return { ok: false, code: "INVALID_SOURCE_TYPE", message: "Type de source inconnu." };
  }

  let ctx: string | null = null;
  if (context != null) {
    if (typeof context !== "string") {
      return { ok: false, code: "INVALID_CONTEXT", message: "Le contexte doit être un texte." };
    }
    ctx = sanitizeText(context) || null;
    if (ctx && ctx.length > MAX_CONTEXT_CHARS) {
      return {
        ok: false,
        code: "CONTEXT_TOO_LONG",
        message: `Le contexte dépasse ${MAX_CONTEXT_CHARS} caractères.`,
      };
    }
  }

  return { ok: true, value: { text: clean, sourceType: type as SourceType, context: ctx } };
}
