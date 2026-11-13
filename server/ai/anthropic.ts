import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_JSON_SCHEMA } from "../../shared/schema";
import { InvalidOutputError, parseModelJson } from "../../shared/normalize";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { ProviderError, type Extractor } from "./types";

export const PROVIDER_NAME = "Anthropic (Claude)";

/**
 * Extracteur basé sur l'API Claude.
 * - Sortie contrainte par JSON Schema (`output_config.format`), puis revalidée côté serveur.
 * - `fallbacks: "default"` : si le modèle décline la requête, l'API la rejoue sur un modèle de repli.
 * - Aucune donnée du texte n'est journalisée.
 */
export function createAnthropicExtractor(opts: { apiKey: string; model: string }): Extractor {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 90_000, maxRetries: 1 });

  return async (input, signal) => {
    let response: Anthropic.Beta.Messages.BetaMessage;
    try {
      response = await client.beta.messages.create(
        {
          model: opts.model,
          max_tokens: 16_000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: {
            effort: "medium",
            format: { type: "json_schema", schema: EXTRACTION_JSON_SCHEMA },
          },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserMessage(input) }],
        },
        { signal },
      );
    } catch (err) {
      if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError) {
        throw new ProviderError("PROVIDER_BUSY", "Le service d'IA est momentanément saturé. Réessayez dans un instant.");
      }
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new ProviderError("PROVIDER_CONFIG", "Le service d'IA est mal configuré côté serveur.");
      }
      if (err instanceof Anthropic.APIError) {
        throw new ProviderError("PROVIDER_UNAVAILABLE", "Le service d'IA n'a pas pu traiter la demande.");
      }
      throw err;
    }

    if (response.stop_reason === "refusal") {
      throw new ProviderError("PROVIDER_REFUSED", "Le modèle n'a pas pu analyser ce texte.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new InvalidOutputError("La réponse du modèle a été tronquée.");
    }

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    if (!text.trim()) throw new InvalidOutputError("Le modèle n'a renvoyé aucun contenu.");
    return parseModelJson(text);
  };
}
