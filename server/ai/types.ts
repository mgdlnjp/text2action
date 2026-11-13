import type { ExtractInput } from "../validation";

/** Un extracteur renvoie la sortie brute (non validée) ; la normalisation est faite en aval. */
export type Extractor = (input: ExtractInput, signal?: AbortSignal) => Promise<unknown>;

export class ProviderError extends Error {
  constructor(
    public readonly code: "PROVIDER_REFUSED" | "PROVIDER_BUSY" | "PROVIDER_UNAVAILABLE" | "PROVIDER_CONFIG",
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
