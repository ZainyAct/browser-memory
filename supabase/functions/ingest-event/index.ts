import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getAuthHeader } from "../_shared/auth.ts";
import { createSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") return optionsResponse(origin);

  const auth = getAuthHeader(req);
  if (!auth) return jsonResponse({ detail: "Missing Bearer token" }, 401, origin);

  const supabase = createSupabaseClient(req);
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return jsonResponse({ detail: "Invalid token" }, 401, origin);

  let body: { type: string; url?: string; title?: string; text_content?: string; selector?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ detail: "Invalid JSON" }, 400, origin);
  }
  if (!body?.type) return jsonResponse({ detail: "Missing type" }, 400, origin);

  const payload = {
    user_id: user.id,
    type: body.type,
    url: body.url ?? null,
    title: body.title ?? null,
    text_content: body.text_content ?? null,
    selector: body.selector ?? null,
    metadata: body.metadata ?? {},
  };

  const { data, error } = await supabase.from("events").insert(payload).select("id").single();
  if (error) return jsonResponse({ detail: error.message }, 500, origin);
  return jsonResponse({ inserted: 1 }, 200, origin);
});
