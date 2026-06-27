// Lightweight Bearer-token auth helper for public TanStack server routes.
// Validates the Supabase access token using the publishable key + getClaims.
import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  // Fall back to VITE_-prefixed vars when the server-side (no-prefix) env
  // vars aren't set. Vercel often only exposes VITE_* to server-side code
  // when configured via the dashboard, and requireAuth's createClient throws
  // a cryptic error if these are undefined — which the catch below silently
  // turns into "401 Unauthorized", masking the real config issue.
  const url =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing on server. Add SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY (or VITE_-prefixed equivalents) to Vercel → Settings → Environment Variables → Production.",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  return _client;
}

export async function requireAuth(
  request: Request,
): Promise<{ userId: string } | Response> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const token = header.slice(7).trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const { data, error } = await getClient().auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    return { userId: data.claims.sub as string };
  } catch (e: any) {
    // Surface the real config error to the client so users know whether to
    // fix their Vercel env vars (vs. just logging in again). Without this,
    // the server logs the error but the client just sees "401" forever.
    console.error("[requireAuth] token validation failed:", e?.message || e);
    const msg = (e?.message || "").includes("Supabase env vars missing")
      ? "Server configuration error: " + e.message
      : "Unauthorized";
    return new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
}

// Strip control characters and cap length to mitigate prompt injection.
export function sanitizeUserText(input: unknown, maxLen = 2000): string {
  const s = typeof input === "string" ? input : "";
  // Remove ASCII control chars (except \n, \r, \t) and zero-width/bidi tricks.
  const cleaned = s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "");
  return cleaned.slice(0, maxLen).trim();
}
