import type { AccessInfo } from "../../shared/billing";
import { authHeaders, ensureFreshToken, refreshToken, setToken } from "./billing";
import type {
  ApiErrorBody,
  ExtractionResult,
  HealthInfo,
  SourceType,
} from "../../shared/schema";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly access?: AccessInfo,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody & { access?: AccessInfo };
    if (body?.error?.message) return new ApiError(body.error.code, body.error.message, body.access);
  } catch {
    /* corps non JSON */
  }
  return new ApiError("HTTP_" + res.status, "Le serveur n'a pas pu traiter la demande.");
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthInfo> {
  const res = await fetch("/api/health", { signal });
  if (!res.ok) throw await readError(res);
  return (await res.json()) as HealthInfo;
}

export async function extractActions(
  payload: { text: string; sourceType: SourceType; context: string },
  signal?: AbortSignal,
  retried = false,
): Promise<ExtractionResult> {
  await ensureFreshToken();
  let res: Response;
  try {
    res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ ...payload, context: payload.context.trim() || null }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("NETWORK", "Connexion au serveur impossible. Vérifiez votre réseau.");
  }
  if (!res.ok) {
    const error = await readError(res);
    // Jeton Pro expiré : on le renouvelle (ou on l'abandonne) puis on réessaie une fois.
    if (error.code === "TOKEN_EXPIRED" && !retried) {
      if (!(await refreshToken())) setToken(null);
      return extractActions(payload, signal, true);
    }
    throw error;
  }
  return (await res.json()) as ExtractionResult;
}
