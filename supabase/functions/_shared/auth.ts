import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getAuthHeader(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.trim();
}

export function createSupabaseClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization");
  return createClient(url, key, {
    global: { headers: auth ? { Authorization: auth } : {} },
  });
}
