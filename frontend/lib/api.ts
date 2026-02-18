import { createClient } from "@supabase/supabase-js";
import type { Memory, BrowserEvent, WorkflowGraph, AnalyticsCharts } from "./types";

const STORAGE_URL_KEY = "browser_memory_supabase_url";
const STORAGE_ANON_KEY = "browser_memory_supabase_anon_key";
const PLACEHOLDER = "https://placeholder.supabase.co";

export function getSupabaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_URL_KEY);
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER;
}

function getSupabaseAnonKey(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_ANON_KEY);
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
}

export const isConfigured =
  typeof window === "undefined" ||
  (!!getSupabaseUrl() &&
    !getSupabaseUrl().includes("placeholder") &&
    !!getSupabaseAnonKey() &&
    !getSupabaseAnonKey().includes("placeholder"));

export const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

/** Base URL for API: Supabase Edge Functions (default) or custom backend. */
export function getApiBase(): string {
  const custom = process.env.NEXT_PUBLIC_API_BASE;
  if (custom && !custom.includes("placeholder")) return custom;
  const url = getSupabaseUrl();
  if (url && !url.includes("placeholder")) return `${url.replace(/\/$/, "")}/functions/v1`;
  return "";
}

/** Set Supabase config in localStorage so visitors can use their own project (e.g. from GitHub Pages). */
export function setRuntimeSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
}

/** Clear runtime Supabase config from localStorage. */
export function clearRuntimeSupabaseConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
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
