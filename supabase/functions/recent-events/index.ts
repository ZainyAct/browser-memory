import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthHeader } from "../_shared/auth.ts";
import { createSupabaseClient } from "../_shared/auth.ts";
import { safeHost } from "../_shared/summarizer.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  const auth = getAuthHeader(req);
  if (!auth) return jsonResponse({ detail: "Missing Bearer token" }, 401, origin);

  const url = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1), 500);
  const host = url.searchParams.get("host")?.trim() || null;
  const fetchLimit = host ? Math.min(500, limit * 3) : limit;

  const supabase = createSupabaseClient(req);
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return jsonResponse({ detail: "Invalid token" }, 401, origin);

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(fetchLimit);
  if (error) return jsonResponse({ detail: error.message }, 500, origin);

  let result = events ?? [];
  if (host) result = result.filter((e: { url?: string }) => safeHost(e.url) === host).slice(0, limit);
  return jsonResponse({ results: result }, 200, origin);
});
