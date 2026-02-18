import { safeHost } from "./summarizer.ts";

interface EventRow {
  created_at?: string;
  url?: string;
  type?: string;
}

export function buildAnalyticsCharts(events: EventRow[]): {
  by_type: { type: string; count: number }[];
  by_host: { host: string; count: number }[];
  over_time: { date: string; count: number }[];
} {
  const byType: Record<string, number> = {};
  const byHost: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  for (const e of events) {
    const t = e.type || "unknown";
    byType[t] = (byType[t] || 0) + 1;
    const h = safeHost(e.url) || "unknown";
    byHost[h] = (byHost[h] || 0) + 1;
    if (e.created_at) {
      try {
        const d = new Date(e.created_at).toISOString().slice(0, 10);
        byDate[d] = (byDate[d] || 0) + 1;
      } catch {}
    }
  }

  const by_type = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));
  const topHosts = Object.entries(byHost)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const by_host = topHosts.map(([host, count]) => ({ host, count }));
  const over_time = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  return { by_type, by_host, over_time };
}
