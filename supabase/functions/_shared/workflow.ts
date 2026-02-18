import { safeHost } from "./summarizer.ts";

interface EventRow {
  created_at?: string;
  url?: string;
  type?: string;
}

export function buildWorkflowGraph(events: EventRow[]): { nodes: unknown[]; edges: unknown[] } {
  if (!events.length) return { nodes: [], edges: [] };

  const sorted = [...events].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const hostStats = new Map<string, Record<string, number>>();
  const edgeCounts = new Map<string, number>();
  let prevHost: string | null = null;

  for (const e of sorted) {
    const host = safeHost(e.url) || "unknown";
    if (!hostStats.has(host)) hostStats.set(host, {});
    const stats = hostStats.get(host)!;
    const t = e.type || "unknown";
    stats[t] = (stats[t] || 0) + 1;

    if (prevHost !== null && prevHost !== host) {
      const key = `${prevHost}->${host}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    prevHost = host;
  }

  const nodes = Array.from(hostStats.entries()).map(([host, stats]) => {
    const parts = Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, c]) => `${t}:${c}`);
    const label = parts.length ? `${host} (${parts.join(", ")})` : host;
    return { id: host, label, host, stats };
  });

  const edges = Array.from(edgeCounts.entries()).map(([key, count]) => {
    const [source, target] = key.split("->");
    return { id: key, source, target, count, label: count > 1 ? String(count) : null };
  });

  return { nodes, edges };
}
