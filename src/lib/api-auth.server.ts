// Lightweight Bearer-token auth helper for public TanStack server routes.
// Validates the Supabase access token using the publishable key + getClaims.
import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
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
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
