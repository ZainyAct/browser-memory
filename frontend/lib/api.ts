import { createClient } from "@supabase/supabase-js";
import type { Memory, BrowserEvent, WorkflowGraph, AnalyticsCharts } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

export const isConfigured =
  typeof window === "undefined" ||
  (!!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes("placeholder"));

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Base URL for API: Supabase Edge Functions (default) or custom backend. */
export function getApiBase(): string {
  const custom = process.env.NEXT_PUBLIC_API_BASE;
  if (custom && !custom.includes("placeholder")) return custom;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && !url.includes("placeholder")) return `${url.replace(/\/$/, "")}/functions/v1`;
  return "";
}

export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBase();
  if (!base) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL (or NEXT_PUBLIC_API_BASE) in .env.local");

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not logged in");

  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {
    throw new Error("Could not reach the API. Check your Supabase project and that Edge Functions are deployed.");
  });
  return res;
}

export async function searchMemories(q: string, limit = 20): Promise<Memory[]> {
  const res = await authedFetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  const json = (await res.json()) as { results?: Memory[] };
  return json.results ?? [];
}

export async function getRecentMemories(limit = 50): Promise<Memory[]> {
  const res = await authedFetch(`/recent-memories?limit=${limit}`);
  const json = (await res.json()) as { results?: Memory[] };
  return json.results ?? [];
}

export async function getRecentEvents(limit = 100, host?: string): Promise<BrowserEvent[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (host) params.set("host", host);
  const res = await authedFetch(`/recent-events?${params}`);
  const json = (await res.json()) as { results?: BrowserEvent[] };
  return json.results ?? [];
}

export async function runSummarize(minutes = 20): Promise<{ created_memories: number; reason?: string }> {
  const res = await authedFetch("/summarize-run", {
    method: "POST",
    body: JSON.stringify({ minutes }),
  });
  return res.json() as Promise<{ created_memories: number; reason?: string }>;
}

export async function getWorkflowGraph(limit = 500): Promise<WorkflowGraph> {
  const res = await authedFetch(`/workflow-graph?limit=${limit}`);
  return res.json() as Promise<WorkflowGraph>;
}

export async function getAnalyticsCharts(limit = 1000): Promise<AnalyticsCharts> {
  const res = await authedFetch(`/analytics-charts?limit=${limit}`);
  return res.json() as Promise<AnalyticsCharts>;
}
