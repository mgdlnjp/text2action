import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler, type Response } from "express";
import { InvalidOutputError, normalizeExtraction } from "../shared/normalize";
import type { ApiErrorBody, ExtractionResult, HealthInfo } from "../shared/schema";
import { createAnthropicExtractor, PROVIDER_NAME } from "./ai/anthropic";
import { demoExtractor } from "./ai/demo";
import { ProviderError, type Extractor } from "./ai/types";
import { createStripeProvider, type BillingProvider } from "./billing/provider";
import { createFreeQuota, type FreeQuota } from "./billing/quota";
import { accessInfo, createBillingRouter, resolveAccess, type BillingContext } from "./billing/routes";
import type { AppConfig } from "./config";
import { createRateLimiter } from "./rateLimit";
import { validateExtractRequest } from "./validation";

export interface AppDeps {
  extractor?: Extractor;
  /** Journalisation de métadonnées uniquement — jamais le texte. */
  log?: (event: Record<string, unknown>) => void;
  /** Prestataire de paiement (Stripe par défaut si configuré). */
  billingProvider?: BillingProvider | null;
  quota?: FreeQuota;
}

function sendError(res: Response, status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
}

export function createApp(config: AppConfig, deps: AppDeps = {}) {
  const app = express();
  const log = deps.log ?? ((e) => console.info(JSON.stringify(e)));
  const extractor =
    deps.extractor ??
    (config.mode === "ai" && config.anthropicApiKey
      ? createAnthropicExtractor({ apiKey: config.anthropicApiKey, model: config.model })
      : demoExtractor);

  const billing: BillingContext = {
    settings: config.billing,
    provider:
      deps.billingProvider !== undefined
        ? deps.billingProvider
        : config.billing
          ? createStripeProvider({
              secretKey: config.billing.stripeSecretKey,
              priceId: config.billing.stripePriceId,
            })
          : null,
    quota: deps.quota ?? createFreeQuota(config.freePerDay),
    freePerDay: config.freePerDay,
    log,
  };

  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    next();
  });

  // Corps limité : ~4 octets par caractère au pire + marge pour le JSON.
  const bodyLimit = `${Math.ceil((config.maxTextChars * 4 + 4_096) / 1024)}kb`;
  app.use("/api", express.json({ limit: bodyLimit }), (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    const info: HealthInfo = {
      mode: config.mode,
      provider: config.mode === "ai" ? PROVIDER_NAME : null,
      maxTextChars: config.maxTextChars,
    };
    res.json(info);
  });

  app.post(
    "/api/extract",
    createRateLimiter({ limit: config.rateLimitPerMinute }),
    async (req, res) => {
      const started = Date.now();
      const validation = validateExtractRequest(req.body, config.maxTextChars);
      if (!validation.ok) {
        sendError(res, 400, validation.code, validation.message);
        return;
      }
      const input = validation.value;

      // Droits d'accès : Pro (jeton valide), gratuit (quota serveur) ou libre (facturation désactivée).
      const decision = resolveAccess(billing, req);
      if (decision.kind === "expired") {
        sendError(res, 401, "TOKEN_EXPIRED", "Votre accès doit être renouvelé.");
        return;
      }
      let remaining: number | undefined;
      if (decision.kind === "free") {
        const quota = billing.quota.consume(decision.key);
        if (!quota.allowed) {
          res.status(402).json({
            error: {
              code: "QUOTA_EXCEEDED",
              message: "Vous avez utilisé vos extractions gratuites.",
            },
            access: accessInfo(billing, decision, 0),
          });
          return;
        }
        remaining = quota.remaining;
      }
      const refund = () => {
        if (decision.kind === "free") billing.quota.refund(decision.key);
      };
      const abort = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abort.abort();
      });

      try {
        const raw = await extractor(input, abort.signal);
        const result: ExtractionResult = {
          ...normalizeExtraction(raw, input.text, { mode: config.mode }),
          access: accessInfo(billing, decision, remaining),
        };
        log({
          event: "extract",
          mode: config.mode,
          chars: input.text.length,
          sourceType: input.sourceType,
          tasks: result.tasks.length,
          ms: Date.now() - started,
        });
        res.json(result);
      } catch (err) {
        refund();
        const base = { event: "extract_error", mode: config.mode, ms: Date.now() - started };
        if (err instanceof InvalidOutputError) {
          log({ ...base, code: "INVALID_AI_OUTPUT" });
          sendError(
            res,
            502,
            "INVALID_AI_OUTPUT",
            "La réponse de l'IA était inexploitable. Réessayez ; si le problème persiste, raccourcissez le texte.",
          );
          return;
        }
        if (err instanceof ProviderError) {
          log({ ...base, code: err.code });
          const status = err.code === "PROVIDER_REFUSED" ? 422 : err.code === "PROVIDER_CONFIG" ? 500 : 503;
          sendError(res, status, err.code, err.message);
          return;
        }
        if (abort.signal.aborted) return;
        log({ ...base, code: "INTERNAL", name: err instanceof Error ? err.name : "unknown" });
        sendError(res, 500, "INTERNAL", "Une erreur inattendue est survenue.");
      }
    },
  );

  app.use("/api/billing", createBillingRouter(billing));

  app.use("/api", (_req, res) => sendError(res, 404, "NOT_FOUND", "Route inconnue."));

  if (config.serveStatic) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dist = path.resolve(here, "../dist");
    app.use(express.static(dist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // Ne jamais journaliser le corps de requête : seulement le type d'erreur.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    if (status === 413) {
      sendError(res, 413, "PAYLOAD_TOO_LARGE", "Le texte envoyé est trop volumineux.");
      return;
    }
    if (status === 400) {
      sendError(res, 400, "INVALID_JSON", "Requête mal formée.");
      return;
    }
    log({ event: "server_error", name: err?.name ?? "unknown" });
    sendError(res, 500, "INTERNAL", "Une erreur inattendue est survenue.");
  };
  app.use(onError);

  return app;
}
