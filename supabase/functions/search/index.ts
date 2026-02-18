import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthHeader } from "../_shared/auth.ts";
import { createSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  const auth = getAuthHeader(req);
  if (!auth) return jsonResponse({ detail: "Missing Bearer token" }, 401, origin);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
  if (!q) return jsonResponse({ detail: "Missing q" }, 400, origin);

  const supabase = createSupabaseClient(req);
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return jsonResponse({ detail: "Invalid token" }, 401, origin);

  const { data: rpcData, error: rpcError } = await supabase.rpc("search_memories", { q, lim: limit });
  if (!rpcError && rpcData) return jsonResponse({ results: rpcData }, 200, origin);

  const { data: fallback, error: fallbackError } = await supabase
    .from("memories")
    .select("*")
    .eq("user_id", user.id)
    .ilike("summary_text", `%${q}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (fallbackError) return jsonResponse({ detail: fallbackError.message }, 500, origin);
  return jsonResponse({ results: fallback ?? [] }, 200, origin);
});
