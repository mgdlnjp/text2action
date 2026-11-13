import type { RequestHandler } from "express";

/**
 * Limite de fréquence simple, en mémoire, par IP et fenêtre fixe.
 * Suffisant pour une instance unique ; utiliser Redis ou le proxy si plusieurs instances.
 */
export function createRateLimiter(opts: {
  limit: number;
  windowMs?: number;
  now?: () => number;
}): RequestHandler {
  const windowMs = opts.windowMs ?? 60_000;
  const now = opts.now ?? Date.now;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const t = now();
    if (hits.size > 10_000) {
      for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
    }
    const key = req.ip ?? "unknown";
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader("RateLimit-Limit", String(opts.limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, opts.limit - entry.count)));
    if (entry.count > opts.limit) {
      const retryAfter = Math.ceil((entry.resetAt - t) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: `Trop de demandes. Réessayez dans ${retryAfter} s.`,
        },
      });
      return;
    }
    next();
  };
}
