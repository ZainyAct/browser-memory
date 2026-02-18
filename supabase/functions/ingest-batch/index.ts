import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthHeader } from "../_shared/auth.ts";
import { createSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return optionsResponse(origin);

  const auth = getAuthHeader(req);
  if (!auth) return jsonResponse({ detail: "Missing Bearer token" }, 401, origin);

  const supabase = createSupabaseClient(req);
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return jsonResponse({ detail: "Invalid token" }, 401, origin);

  let body: { events?: { type: string; url?: string; title?: string; text_content?: string; selector?: string; metadata?: Record<string, unknown> }[] };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON" }, 400, origin);
  }
  const events = body?.events ?? [];
  if (!events.length) return jsonResponse({ inserted: 0 }, 200, origin);

  const rows = events.map((e: { type: string; url?: string; title?: string; text_content?: string; selector?: string; metadata?: Record<string, unknown> }) => ({
    user_id: user.id,
    type: e.type,
    url: e.url ?? null,
    title: e.title ?? null,
    text_content: e.text_content ?? null,
    selector: e.selector ?? null,
    metadata: e.metadata ?? {},
  }));

  const { data, error } = await supabase.from("events").insert(rows).select("id");
  if (error) return jsonResponse({ detail: error.message }, 500, origin);
  return jsonResponse({ inserted: data?.length ?? 0 }, 200, origin);
});
