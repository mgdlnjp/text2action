import { DEFAULT_MAX_TEXT_CHARS, type ExtractionMode } from "../shared/schema";

export interface BillingSettings {
  stripeSecretKey: string;
  stripePriceId: string;
  /** Secret HMAC des jetons d'accès (≥ 32 caractères). */
  tokenSecret: string;
  /** URL publique de l'app pour les redirections Stripe (sinon déduite de la requête). */
  appUrl: string | null;
}

export interface AppConfig {
  mode: ExtractionMode;
  anthropicApiKey: string | null;
  model: string;
  port: number;
  maxTextChars: number;
  rateLimitPerMinute: number;
  trustProxy: boolean;
  serveStatic: boolean;
  /** `null` : facturation désactivée, l'outil est en accès libre. */
  billing: BillingSettings | null;
  freePerDay: number;
}

function int(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

function loadBilling(env: NodeJS.ProcessEnv): BillingSettings | null {
  const stripeSecretKey = env.STRIPE_SECRET_KEY?.trim();
  const stripePriceId = env.STRIPE_PRICE_ID?.trim();
  if (!stripeSecretKey || !stripePriceId) return null;

  const tokenSecret = env.ACCESS_TOKEN_SECRET?.trim() ?? "";
  if (tokenSecret.length < 32) {
    throw new Error(
      "ACCESS_TOKEN_SECRET doit contenir au moins 32 caractères quand Stripe est configuré (ex. : openssl rand -base64 48).",
    );
  }
  const appUrl = env.APP_URL?.trim().replace(/\/+$/, "") || null;
  if (appUrl && !/^https?:\/\/[^/\s]+$/.test(appUrl)) {
    throw new Error("APP_URL doit être une origine du type https://exemple.fr (sans chemin).");
  }
  return { stripeSecretKey, stripePriceId, tokenSecret, appUrl };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const key = env.ANTHROPIC_API_KEY?.trim() || null;
  const forceDemo = env.DEMO_MODE?.toLowerCase() === "true";
  return {
    mode: key && !forceDemo ? "ai" : "demo",
    anthropicApiKey: key,
    model: env.AI_MODEL?.trim() || "claude-opus-5-5",
    port: int(env.PORT, 8787, 1, 65_535),
    maxTextChars: int(env.MAX_TEXT_CHARS, DEFAULT_MAX_TEXT_CHARS, 500, 50_000),
    rateLimitPerMinute: int(env.RATE_LIMIT_PER_MINUTE, 8, 1, 1_000),
    trustProxy: env.TRUST_PROXY?.toLowerCase() === "true",
    serveStatic: env.NODE_ENV === "production",
    billing: loadBilling(env),
    freePerDay: int(env.FREE_EXTRACTIONS_PER_DAY, 3, 0, 1_000),
  };
}
