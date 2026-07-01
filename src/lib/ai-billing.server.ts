// Server-side AI wallet charge helper.
// Uses the caller's Supabase JWT so the SECURITY DEFINER `charge_ai_prompt`
// RPC sees the real auth.uid() and cannot be bypassed by any client-side
// omission of the charge. Every AI route MUST call this after requireAuth().
import { createClient } from "@supabase/supabase-js";

const DEFAULT_COST_USD = 0.20;

export async function chargeAiForRequest(
  request: Request,
  costUsd: number = DEFAULT_COST_USD,
  prompt: string = "server-side AI request",
): Promise<{ ok: true } | Response> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!url || !key) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: Supabase env vars missing." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  // Look up caller id (needed by charge_ai_prompt); getClaims returns sub.
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub as string | undefined;
  if (claimsErr || !userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const { data, error } = await supabase.rpc("charge_ai_prompt", {
    p_user_id: userId,
    p_provider_id: null,
    p_prompt: prompt.slice(0, 400),
    p_cost_usd: costUsd,
  });

  if (error) {
    return new Response(
      JSON.stringify({ error: `Billing failed: ${error.message}` }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }
  if (data && (data as any).success === false) {
    return new Response(
      JSON.stringify({
        error: "Insufficient funds. Please top up your wallet.",
        reason: (data as any).reason,
        required_naira: (data as any).required_naira,
        balance_naira: (data as any).balance_naira,
      }),
      { status: 402, headers: { "content-type": "application/json" } },
    );
  }
  return { ok: true };
}
