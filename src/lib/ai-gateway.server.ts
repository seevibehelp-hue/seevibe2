import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Universal AI provider dispatcher.
 *
 * Server-side resolves the admin-configured `ai_providers` row from Supabase
 * using the SERVICE ROLE key (RLS bypass — server-only) and builds the
 * corresponding AI SDK `LanguageModelV1`. The client never sees API keys.
 *
 * Supported `provider_type` values:
 *   - "lovable"            → Lovable AI Gateway (uses platform LOVABLE_API_KEY)
 *   - "openai_compatible"  → any OpenAI-compatible endpoint (OpenAI, Mistral, Groq, local llama.cpp, etc.)
 *   - "gemini_direct"      → Google's Gemini OpenAI-compatible endpoint
 *
 * Falls back to the Lovable AI Gateway when no providerId is sent (or when the
 * sent providerId doesn't resolve to an active row) — preserves prior behavior
 * for any client code path that hasn't been updated yet.
 */

export type ProviderType = "lovable" | "openai_compatible" | "gemini_direct";

export interface ProviderLookupRequest {
  providerId?: string | null;
}

export interface ResolvedProvider {
  id: string | null;
  provider_type: ProviderType;
  endpoint: string;
  model: string;
  api_key: string | null;
}

export interface ResolvedModel {
  model: LanguageModelV3;
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

let _adminClient: SupabaseClient | null = null;
function getAdminClient(): SupabaseClient {
  if (_adminClient) return _adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Server is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "Add the service role key from Supabase Settings → API → service_role " +
        "(secret) to the server environment to enable admin-configured AI providers.",
    );
  }
  _adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  return _adminClient;
}

function assertLovableKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) {
    throw new Error(
      "LOVABLE_API_KEY is not configured. Either set it in the server environment, " +
        "or switch the active AI provider away from 'lovable' in the Admin dashboard.",
    );
  }
  return key;
}

/**
 * Look up an admin-configured provider row server-side.
 * Returns null when no providerId was sent, the row is missing, or it's inactive.
 * Never throws on lookup failure — falls through to the Lovable default.
 */
async function lookupProvider(
  providerId: string | null | undefined,
): Promise<ResolvedProvider | null> {
  if (!providerId) return null;
  // Only proceed if the service role key is configured. Without it, server-side
  // lookup is impossible (RLS blocks non-admin reads of `ai_providers`).
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const { data, error } = await getAdminClient()
      .from("ai_providers")
      .select("id, provider_type, endpoint, model, api_key, is_active")
      .eq("id", providerId)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as any;
    return {
      id: row.id,
      provider_type: row.provider_type,
      endpoint: row.endpoint,
      model: row.model,
      api_key: row.api_key,
    };
  } catch (e) {
    console.warn(`[ai-gateway] provider lookup failed for ${providerId}:`, e);
    return null;
  }
}

function buildLovableModel(modelName: string) {
  const key = assertLovableKey();
  return createLovableAiGatewayProvider(key)(modelName);
}

export async function resolveModel(
  request: ProviderLookupRequest | null | undefined,
): Promise<ResolvedModel> {
  const lookedUp = await lookupProvider(request?.providerId);

  // If the client didn't send a providerId (or it didn't resolve), fall back
  // to the Lovable AI Gateway.
  if (!lookedUp) {
    const fallbackModel = "google/gemini-2.5-flash";
    return {
      model: buildLovableModel(fallbackModel),
      provider: {
        id: null,
        provider_type: "lovable",
        endpoint: "https://ai.gateway.lovable.dev/v1",
        model: fallbackModel,
        api_key: null,
      },
    };
  }

  switch (lookedUp.provider_type) {
    case "lovable": {
      const modelName = lookedUp.model?.trim() || "google/gemini-2.5-flash";
      return {
        model: buildLovableModel(modelName),
        provider: {
          id: lookedUp.id,
          provider_type: "lovable",
          endpoint: "https://ai.gateway.lovable.dev/v1",
          model: modelName,
          api_key: null,
        },
      };
    }

    case "openai_compatible": {
      const endpoint = lookedUp.endpoint?.trim();
      const modelName = lookedUp.model?.trim();
      const apiKey = lookedUp.api_key?.trim();
      if (!endpoint) throw new Error("OpenAI-compatible provider missing endpoint");
      if (!modelName) throw new Error("OpenAI-compatible provider missing model");
      if (!apiKey) throw new Error("OpenAI-compatible provider missing api_key");
      const compat = createOpenAICompatible({
        name: lookedUp.id || "openai_compatible",
        baseURL: endpoint,
        apiKey,
      });
      return {
        model: compat(modelName),
        provider: {
          id: lookedUp.id,
          provider_type: "openai_compatible",
          endpoint,
          model: modelName,
          api_key: apiKey,
        },
      };
    }

    case "gemini_direct": {
      const endpoint = lookedUp.endpoint?.trim();
      const modelName = lookedUp.model?.trim();
      const apiKey = lookedUp.api_key?.trim();
      if (!endpoint) throw new Error("Gemini direct provider missing endpoint");
      if (!modelName) throw new Error("Gemini direct provider missing model");
      if (!apiKey) throw new Error("Gemini direct provider missing api_key");
      // Google's OpenAI-compatible endpoint at
      //   https://generativelanguage.googleapis.com/v1beta/openai
      // with `Authorization: Bearer <apiKey>` works through the
      // @ai-sdk/openai-compatible package's default Bearer auth.
      const compat = createOpenAICompatible({
        name: lookedUp.id || "gemini",
        baseURL: endpoint,
        apiKey,
      });
      return {
        model: compat(modelName),
        provider: {
          id: lookedUp.id,
          provider_type: "gemini_direct",
          endpoint,
          model: modelName,
          api_key: apiKey,
        },
      };
    }

    default: {
      // Unknown provider_type — fall back to Lovable so chat still works.
      const fallbackModel = "google/gemini-2.5-flash";
      console.warn(
        `[ai-gateway] Unknown provider_type: ${(lookedUp as any).provider_type}; falling back to Lovable.`,
      );
      return {
        model: buildLovableModel(fallbackModel),
        provider: {
          id: lookedUp.id,
          provider_type: "lovable",
          endpoint: "https://ai.gateway.lovable.dev/v1",
          model: fallbackModel,
          api_key: null,
        },
      };
    }
  }
}
