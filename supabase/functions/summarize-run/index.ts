import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthHeader } from "../_shared/auth.ts";
import { createSupabaseClient } from "../_shared/auth.ts";
import { summarizeEvents } from "../_shared/summarizer.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  const auth = getAuthHeader(req);
  if (!auth) return jsonResponse({ detail: "Missing Bearer token" }, 401, origin);

  const supabase = createSupabaseClient(req);
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return jsonResponse({ detail: "Invalid token" }, 401, origin);

  let body: { minutes?: number } = {};
  try {
    if (req.method === "POST" && req.body) body = await req.json();
  } catch {}
  const minutes = Math.min(Math.max(body?.minutes ?? 20, 1), 1440);
  const start = new Date(Date.now() - minutes * 60 * 1000).toISOString();

  const { data: events, error: fetchError } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", user.id)
    .gte("created_at", start)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (fetchError) return jsonResponse({ detail: fetchError.message }, 500, origin);
  if (!events?.length) return jsonResponse({ created_memories: 0, reason: "no recent events" }, 200, origin);

  const memoryRows = summarizeEvents(events).map((row) => ({ ...row, user_id: user.id }));
  const { data: inserted, error: insertError } = await supabase.from("memories").insert(memoryRows).select("id");
  if (insertError) return jsonResponse({ detail: insertError.message }, 500, origin);
  return jsonResponse({ created_memories: inserted?.length ?? 0 }, 200, origin);
});
