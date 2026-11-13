import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { Extractor } from "../server/ai/types";
import { createApp } from "../server/app";
import { BillingUnavailableError, type BillingProvider } from "../server/billing/provider";
import { createFreeQuota } from "../server/billing/quota";
import { ACCESS_TOKEN_TTL_MS, signAccessToken, verifyAccessToken } from "../server/billing/token";
import { loadConfig, type AppConfig } from "../server/config";
import { formatPrice } from "../shared/billing";

const SECRET = "x".repeat(40);
const TEXT = "Bonjour, Marie doit envoyer le devis au client avant vendredi. Merci !";
const SESSION = "cs_test_a1B2c3D4e5F6g7H8";

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    mode: "demo",
    anthropicApiKey: null,
    model: "claude-opus-5-5",
    port: 0,
    maxTextChars: 5_000,
    rateLimitPerMinute: 1_000,
    trustProxy: false,
    serveStatic: false,
    billing: { stripeSecretKey: "sk_test_x", stripePriceId: "price_x", tokenSecret: SECRET, appUrl: "https://t2a.example" },
    freePerDay: 2,
    ...overrides,
  };
}

function fakeProvider(overrides: Partial<BillingProvider> = {}): BillingProvider {
  return {
    getPrice: async () => ({ amount: 490, currency: "eur", interval: "month", intervalCount: 1 }),
    createCheckout: vi.fn(async ({ successUrl }: { successUrl: string }) => `https://checkout.stripe.test/?next=${encodeURIComponent(successUrl)}`),
    resolveCheckout: async (id) => (id === SESSION ? { subscriptionId: "sub_1", customerId: "cus_1" } : null),
    isSubscriptionActive: async (id) => id === "sub_1",
    createPortal: async ({ customerId }) => `https://billing.stripe.test/${customerId}`,
    ...overrides,
  };
}

function app(opts: { cfg?: Partial<AppConfig>; provider?: BillingProvider | null; extractor?: Extractor } = {}) {
  return createApp(config(opts.cfg), {
    billingProvider: opts.provider === undefined ? fakeProvider() : opts.provider,
    extractor: opts.extractor,
    log: () => {},
  });
}

const proToken = (now = Date.now()) => signAccessToken({ sub: "sub_1", cus: "cus_1" }, SECRET, now);

/* ------------------------------------------------------------------ */

describe("jeton d'accès", () => {
  it("vérifie un jeton valide", () => {
    const result = verifyAccessToken(proToken(), SECRET);
    expect(result.ok && !result.expired && result.payload.sub).toBe("sub_1");
  });
  it("rejette un jeton falsifié ou signé avec un autre secret", () => {
    const token = proToken();
    const [h, , s] = token.split(".");
    const forgedBody = Buffer.from(JSON.stringify({ sub: "sub_x", cus: "cus_x", iat: 0, exp: Date.now() * 2 })).toString(
      "base64url",
    );
    expect(verifyAccessToken(`${h}.${forgedBody}.${s}`, SECRET).ok).toBe(false);
    expect(verifyAccessToken(token, "y".repeat(40)).ok).toBe(false);
    expect(verifyAccessToken("pas.un.jeton", SECRET).ok).toBe(false);
  });
  it("signale un jeton expiré", () => {
    const result = verifyAccessToken(proToken(Date.now() - ACCESS_TOKEN_TTL_MS - 1), SECRET);
    expect(result.ok && result.expired).toBe(true);
  });
});

describe("quota gratuit", () => {
  it("limite, rembourse et se renouvelle après 24 h", () => {
    let t = 0;
    const quota = createFreeQuota(2, () => t);
    expect(quota.consume("ip").allowed).toBe(true);
    expect(quota.consume("ip")).toEqual({ allowed: true, remaining: 0 });
    expect(quota.consume("ip").allowed).toBe(false);
    quota.refund("ip");
    expect(quota.peek("ip")).toBe(1);
    t = 24 * 60 * 60 * 1000 + 1;
    expect(quota.peek("ip")).toBe(2);
  });
});

describe("configuration", () => {
  it("désactive la facturation sans Stripe", () => {
    expect(loadConfig({}).billing).toBeNull();
  });
  it("exige un secret de jeton robuste quand Stripe est configuré", () => {
    expect(() => loadConfig({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_ID: "price" })).toThrow(/ACCESS_TOKEN_SECRET/);
    expect(
      loadConfig({ STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_ID: "price", ACCESS_TOKEN_SECRET: SECRET }).billing,
    ).not.toBeNull();
  });
  it("valide APP_URL", () => {
    const env = { STRIPE_SECRET_KEY: "sk", STRIPE_PRICE_ID: "price", ACCESS_TOKEN_SECRET: SECRET };
    expect(() => loadConfig({ ...env, APP_URL: "javascript:alert(1)" })).toThrow(/APP_URL/);
    expect(loadConfig({ ...env, APP_URL: "https://t2a.fr/" }).billing?.appUrl).toBe("https://t2a.fr");
  });
  it("formate le prix", () => {
    expect(formatPrice({ amount: 490, currency: "eur", interval: "month", intervalCount: 1 })).toMatch(/4,90\s€ \/ mois/);
    expect(formatPrice({ amount: 3900, currency: "eur", interval: "year", intervalCount: 1 })).toMatch(/39\s€ \/ an/);
  });
});

describe("facturation désactivée", () => {
  it("laisse l'outil en accès libre", async () => {
    const a = app({ cfg: { billing: null }, provider: null });
    expect((await request(a).get("/api/billing/config")).body).toMatchObject({ enabled: false, price: null });
    for (let i = 0; i < 4; i++) {
      const res = await request(a).post("/api/extract").send({ text: TEXT });
      expect(res.status).toBe(200);
      expect(res.body.access).toEqual({ plan: "open" });
    }
    expect((await request(a).post("/api/billing/checkout")).status).toBe(404);
  });
});

describe("quota appliqué par le serveur", () => {
  it("bloque au-delà du quota gratuit avec une erreur 402", async () => {
    const a = app();
    const first = await request(a).post("/api/extract").send({ text: TEXT });
    expect(first.body.access).toEqual({ plan: "free", remaining: 1, limit: 2 });
    await request(a).post("/api/extract").send({ text: TEXT });
    const blocked = await request(a).post("/api/extract").send({ text: TEXT });
    expect(blocked.status).toBe(402);
    expect(blocked.body.error.code).toBe("QUOTA_EXCEEDED");
    expect(blocked.body.access).toEqual({ plan: "free", remaining: 0, limit: 2 });
  });

  it("ne consomme pas le quota pour une requête invalide ou une extraction en échec", async () => {
    const failing: Extractor = async () => ({ broken: true });
    const a = app({ extractor: failing });
    await request(a).post("/api/extract").send({ text: "court" });
    expect((await request(a).post("/api/extract").send({ text: TEXT })).status).toBe(502);
    const status = await request(a).get("/api/billing/status");
    expect(status.body).toEqual({ plan: "free", remaining: 2, limit: 2 });
  });

  it("ignore un jeton falsifié (reste en gratuit)", async () => {
    const res = await request(app()).post("/api/extract").set("Authorization", "Bearer faux.jeton.ici").send({ text: TEXT });
    expect(res.body.access.plan).toBe("free");
  });

  it("donne un accès illimité avec un jeton Pro valide", async () => {
    const a = app();
    for (let i = 0; i < 5; i++) {
      const res = await request(a).post("/api/extract").set("Authorization", `Bearer ${proToken()}`).send({ text: TEXT });
      expect(res.status).toBe(200);
      expect(res.body.access).toEqual({ plan: "pro" });
    }
  });

  it("demande un renouvellement pour un jeton expiré", async () => {
    const expired = proToken(Date.now() - ACCESS_TOKEN_TTL_MS - 1_000);
    const res = await request(app()).post("/api/extract").set("Authorization", `Bearer ${expired}`).send({ text: TEXT });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });
});

describe("parcours d'abonnement", () => {
  it("expose le prix récupéré chez Stripe", async () => {
    const res = await request(app()).get("/api/billing/config");
    expect(res.body).toEqual({
      enabled: true,
      freePerDay: 2,
      price: { amount: 490, currency: "eur", interval: "month", intervalCount: 1 },
    });
  });

  it("crée une session Checkout avec l'URL configurée, pas l'en-tête Host", async () => {
    const provider = fakeProvider();
    const res = await request(app({ provider })).post("/api/billing/checkout").set("Host", "evil.example");
    expect(res.status).toBe(200);
    expect(provider.createCheckout).toHaveBeenCalledWith({
      successUrl: "https://t2a.example/abonnement/succes?session_id={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://t2a.example/app",
    });
  });

  it("active l'abonnement après un paiement confirmé et délivre un jeton utilisable", async () => {
    const a = app();
    const res = await request(a).post("/api/billing/activate").send({ sessionId: SESSION });
    expect(res.status).toBe(200);
    const status = await request(a).get("/api/billing/status").set("Authorization", `Bearer ${res.body.token}`);
    expect(status.body).toEqual({ plan: "pro" });
  });

  it("refuse une session invalide ou non payée", async () => {
    const a = app();
    expect((await request(a).post("/api/billing/activate").send({ sessionId: "abc" })).status).toBe(400);
    const unpaid = await request(a).post("/api/billing/activate").send({ sessionId: "cs_test_zzzzzzzzzzzzzzzz" });
    expect(unpaid.status).toBe(402);
  });

  it("renouvelle un jeton expiré tant que l'abonnement est actif", async () => {
    const expired = proToken(Date.now() - ACCESS_TOKEN_TTL_MS - 1_000);
    const res = await request(app()).post("/api/billing/refresh").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(200);
    expect(verifyAccessToken(res.body.token, SECRET).ok).toBe(true);
  });

  it("refuse le renouvellement si l'abonnement n'est plus actif", async () => {
    const a = app({ provider: fakeProvider({ isSubscriptionActive: async () => false }) });
    const res = await request(a).post("/api/billing/refresh").set("Authorization", `Bearer ${proToken()}`);
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("refuse le renouvellement sans jeton signé (un identifiant d'abonnement ne suffit pas)", async () => {
    const res = await request(app()).post("/api/billing/refresh").send({ subscription_id: "sub_1" });
    expect(res.status).toBe(401);
  });

  it("ouvre le portail client pour gérer ou résilier", async () => {
    const res = await request(app()).post("/api/billing/portal").set("Authorization", `Bearer ${proToken()}`);
    expect(res.body.url).toBe("https://billing.stripe.test/cus_1");
    expect((await request(app()).post("/api/billing/portal")).status).toBe(401);
  });

  it("renvoie 503 si Stripe est indisponible", async () => {
    const provider = fakeProvider({
      createCheckout: async () => {
        throw new BillingUnavailableError();
      },
    });
    const res = await request(app({ provider })).post("/api/billing/checkout");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("BILLING_UNAVAILABLE");
  });
});
