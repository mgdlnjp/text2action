/** Normalise un texte pour les comparaisons : minuscules, sans accents, apostrophes/espaces unifiés. */
export function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** Vrai si `needle` apparaît dans `haystack` après normalisation. */
export function containsFolded(haystack: string, needle: string): boolean {
  const n = fold(needle);
  if (!n) return false;
  return fold(haystack).includes(n);
}

/**
 * Vrai si l'extrait est retrouvable dans la source.
 * Tolère les ellipses ("…" / "...") utilisées pour raccourcir un extrait.
 */
export function excerptFoundIn(source: string, excerpt: string): boolean {
  const parts = excerpt
    .split(/…|\.\.\./)
    .map((p) => p.replace(/^["'\s]+|["'\s]+$/g, ""))
    .filter((p) => p.length >= 3);
  if (parts.length === 0) return false;
  const folded = fold(source);
  return parts.every((p) => folded.includes(fold(p)));
}

export function truncate(input: string, max: number): string {
  const t = input.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function cleanString(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t ? truncate(t, max) : null;
}
