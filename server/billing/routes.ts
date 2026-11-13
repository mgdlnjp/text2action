import { Router, type Request, type Response } from "express";
import type { AccessInfo, BillingConfig } from "../../shared/billing";
import type { BillingSettings } from "../config";
import { BillingUnavailableError, type BillingProvider } from "./provider";
import type { FreeQuota } from "./quota";
import { bearerToken, REFRESH_GRACE_MS, signAccessToken, verifyAccessToken } from "./token";

export interface BillingContext {
  settings: BillingSettings | null;
  provider: BillingProvider | null;
  quota: FreeQuota;
  freePerDay: number;
  log: (event: Record<string, unknown>) => void;
}

export type AccessDecision =
  | { kind: "open" }
  | { kind: "pro" }
  | { kind: "free"; key: string }
  | { kind: "expired" };

/** Détermine les droits d'une requête à partir du jeton `Authorization: Bearer`. */
export function resolveAccess(ctx: BillingContext, req: Request): AccessDecision {
  if (!ctx.settings) return { kind: "open" };
  const token = bearerToken(req.headers.authorization);
  if (token) {
    const result = verifyAccessToken(token, ctx.settings.tokenSecret);
    if (result.ok && !result.expired) return { kind: "pro" };
    if (result.ok && result.expired) return { kind: "expired" };
  }
  return { kind: "free", key: req.ip ?? "unknown" };
}

export function accessInfo(ctx: BillingContext, decision: AccessDecision, remaining?: number): AccessInfo {
  if (decision.kind === "open") return { plan: "open" };
  if (decision.kind === "pro") return { plan: "pro" };
  const left = remaining ?? (decision.kind === "free" ? ctx.quota.peek(decision.key) : 0);
  return { plan: "free", remaining: left, limit: ctx.freePerDay };
}

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

function baseUrl(settings: BillingSettings, req: Request): string {
  return settings.appUrl ?? `${req.protocol}://${req.get("host")}`;
}

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

type Handler = (req: Request, res: Response, settings: BillingSettings, provider: BillingProvider) => Promise<void>;

export function createBillingRouter(ctx: BillingContext): Router {
  const router = Router();

  router.get("/config", async (_req, res) => {
    const body: BillingConfig = { enabled: false, freePerDay: ctx.freePerDay, price: null };
    if (!ctx.settings || !ctx.provider) {
      res.json(body);
      return;
    }
    try {
      res.json({ ...body, enabled: true, price: await ctx.provider.getPrice() });
    } catch (err) {
      ctx.log({ event: "billing_error", op: "price", name: err instanceof Error ? err.name : "unknown" });
      res.json(body);
    }
  });

  router.get("/status", (req, res) => {
    const decision = resolveAccess(ctx, req);
    if (decision.kind === "expired") {
      sendError(res, 401, "TOKEN_EXPIRED", "Votre accès doit être renouvelé.");
      return;
    }
    res.json(accessInfo(ctx, decision));
  });

  const handle = (op: string, fn: Handler) => async (req: Request, res: Response) => {
    const { settings, provider } = ctx;
    if (!settings || !provider) {
      sendError(res, 404, "BILLING_DISABLED", "Le paiement n'est pas activé sur cette instance.");
      return;
    }
    try {
      await fn(req, res, settings, provider);
    } catch (err) {
      ctx.log({ event: "billing_error", op, name: err instanceof Error ? err.name : "unknown" });
      if (err instanceof BillingUnavailableError) {
        sendError(res, 503, "BILLING_UNAVAILABLE", "Le service de paiement est momentanément indisponible.");
      } else {
        sendError(res, 500, "INTERNAL", "Une erreur inattendue est survenue.");
      }
    }
  };

  router.post(
    "/checkout",
    handle("checkout", async (req, res, settings, provider) => {
      const origin = baseUrl(settings, req);
      const url = await provider.createCheckout({
        successUrl: `${origin}/abonnement/succes?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/app`,
      });
      res.json({ url });
    }),
  );

  router.post(
    "/activate",
    handle("activate", async (req, res, settings, provider) => {
      const sessionId = (req.body as { sessionId?: unknown } | undefined)?.sessionId;
      if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
        sendError(res, 400, "INVALID_SESSION", "Session de paiement invalide.");
        return;
      }
      const resolved = await provider.resolveCheckout(sessionId);
      if (!resolved) {
        sendError(res, 402, "PAYMENT_NOT_CONFIRMED", "Le paiement n'est pas encore confirmé.");
        return;
      }
      ctx.log({ event: "billing_activate" });
      res.json({
        token: signAccessToken({ sub: resolved.subscriptionId, cus: resolved.customerId }, settings.tokenSecret),
      });
    }),
  );

  /** Vérifie un jeton signé, même expiré, dans la limite du délai de grâce. */
  const tokenFromRequest = (req: Request, settings: BillingSettings) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) return null;
    const result = verifyAccessToken(token, settings.tokenSecret);
    if (!result.ok || Date.now() - result.payload.exp > REFRESH_GRACE_MS) return null;
    return result.payload;
  };

  router.post(
    "/refresh",
    handle("refresh", async (req, res, settings, provider) => {
      const payload = tokenFromRequest(req, settings);
      if (!payload) {
        sendError(res, 401, "INVALID_TOKEN", "Accès introuvable ou trop ancien.");
        return;
      }
      if (!(await provider.isSubscriptionActive(payload.sub))) {
        sendError(res, 402, "SUBSCRIPTION_INACTIVE", "Votre abonnement n'est plus actif.");
        return;
      }
      res.json({ token: signAccessToken({ sub: payload.sub, cus: payload.cus }, settings.tokenSecret) });
    }),
  );

  router.post(
    "/portal",
    handle("portal", async (req, res, settings, provider) => {
      const payload = tokenFromRequest(req, settings);
      if (!payload) {
        sendError(res, 401, "INVALID_TOKEN", "Accès introuvable.");
        return;
      }
      const url = await provider.createPortal({
        customerId: payload.cus,
        returnUrl: `${baseUrl(settings, req)}/app`,
      });
      res.json({ url });
    }),
  );

  return router;
}
