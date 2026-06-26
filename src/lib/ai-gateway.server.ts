import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV1 } from "@ai-sdk/provider";

/**
 * Universal AI provider dispatcher.
 *
 * Resolves a `ProviderRequest` (sent by the client after the admin-configured
 * `ai_providers` row has been selected) into a concrete AI SDK `LanguageModelV1`.
 *
 * Supported `provider_type` values:
 *   - "lovable"            → Lovable AI Gateway (uses platform LOVABLE_API_KEY)
 *   - "openai_compatible"  → any OpenAI-compatible endpoint (OpenAI, Mistral, Groq, local llama.cpp, etc.)
 *   - "gemini_direct"      → Google's Gemini OpenAI-compatible endpoint
 *
 * Falls back to the Lovable AI Gateway when no provider is sent (preserves prior
 * behavior for any client code path that hasn't been updated yet).
 */

export type ProviderType = "lovable" | "openai_compatible" | "gemini_direct";

export interface ProviderRequest {
  id?: string | null;
  provider_type?: ProviderType | null;
  endpoint?: string | null;
  model?: string | null;
  api_key?: string | null;
}

export interface ResolvedProvider {
  id: string | null;
  provider_type: ProviderType;
  endpoint: string;
  model: string;
  api_key: string | null;
}

export interface ResolvedModel {
  model: LanguageModelV1;
  provider: ResolvedProvider;
}

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

function assertLovableKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error(
      "LOVABLE_API_KEY is not configured. Either set it in the server environment, or switch the active AI provider away from 'lovable' in the Admin dashboard."
    );
  }
  return key;
}

export async function resolveModel(
  provider: ProviderRequest | null | undefined,
): Promise<ResolvedModel> {
  // No provider config → Lovable fallback (preserves current behavior)
  if (!provider || !provider.provider_type) {
    const key = assertLovableKey();
    const fallbackModel = "google/gemini-2.5-flash";
    return {
      model: createLovableAiGatewayProvider(key)(fallbackModel),
      provider: {
        id: null,
        provider_type: "lovable",
        endpoint: "https://ai.gateway.lovable.dev/v1",
        model: fallbackModel,
        api_key: null,
      },
    };
  }

  switch (provider.provider_type) {
    case "lovable": {
      const key = assertLovableKey();
      const modelName = provider.model?.trim() || "google/gemini-2.5-flash";
      return {
        model: createLovableAiGatewayProvider(key)(modelName),
        provider: {
          id: provider.id ?? null,
          provider_type: "lovable",
          endpoint: "https://ai.gateway.lovable.dev/v1",
          model: modelName,
          api_key: null,
        },
      };
    }

    case "openai_compatible": {
      const endpoint = provider.endpoint?.trim();
      const modelName = provider.model?.trim();
      const apiKey = provider.api_key?.trim();
      if (!endpoint) throw new Error("OpenAI-compatible provider requires endpoint");
      if (!modelName) throw new Error("OpenAI-compatible provider requires model");
      if (!apiKey) throw new Error("OpenAI-compatible provider requires api_key");
      const compat = createOpenAICompatible({
        name: provider.id || "openai_compatible",
        baseURL: endpoint,
        apiKey,
      });
      return {
        model: compat(modelName),
        provider: {
          id: provider.id ?? null,
          provider_type: "openai_compatible",
          endpoint,
          model: modelName,
          api_key: apiKey,
        },
      };
    }

    case "gemini_direct": {
      const endpoint = provider.endpoint?.trim();
      const modelName = provider.model?.trim();
      const apiKey = provider.api_key?.trim();
      if (!endpoint) throw new Error("Gemini direct provider requires endpoint");
      if (!modelName) throw new Error("Gemini direct provider requires model");
      if (!apiKey) throw new Error("Gemini direct provider requires api_key");
      // Google's Gemini OpenAI-compatible endpoint is reached at
      //   https://generativelanguage.googleapis.com/v1beta/openai
      // with `Authorization: Bearer <apiKey>`. The @ai-sdk/openai-compatible
      // package sends Bearer auth by default, so this works out of the box.
      const compat = createOpenAICompatible({
        name: provider.id || "gemini",
        baseURL: endpoint,
        apiKey,
      });
      return {
        model: compat(modelName),
        provider: {
          id: provider.id ?? null,
          provider_type: "gemini_direct",
          endpoint,
          model: modelName,
          api_key: apiKey,
        },
      };
    }

    default: {
      // Unknown provider_type — fall back to Lovable so the chat still works
      // rather than crashing the user's request.
      const key = assertLovableKey();
      const fallbackModel = "google/gemini-2.5-flash";
      console.warn(
        `[ai-gateway] Unknown provider_type: ${(provider as any).provider_type}; falling back to Lovable.`,
      );
      return {
        model: createLovableAiGatewayProvider(key)(fallbackModel),
        provider: {
          id: provider.id ?? null,
          provider_type: "lovable",
          endpoint: "https://ai.gateway.lovable.dev/v1",
          model: fallbackModel,
          api_key: null,
        },
      };
    }
  }
}