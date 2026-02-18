export function safeHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.hostname || null;
  } catch {
    return null;
  }
}

interface EventRow {
  created_at?: string;
  url?: string;
  type?: string;
  title?: string;
  text_content?: string;
}

export function summarizeEvents(events: EventRow[]): { window_start: string; window_end: string; url_host: string; summary_text: string }[] {
  if (!events.length) return [];

  const times = events.map((e) => e.created_at).filter(Boolean) as string[];
  const window_start = new Date(Math.min(...times.map((t) => new Date(t).getTime()))).toISOString();
  const window_end = new Date(Math.max(...times.map((t) => new Date(t).getTime()))).toISOString();

  const byHost = new Map<string, EventRow[]>();
  for (const e of events) {
    const host = safeHost(e.url) || "unknown";
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host)!.push(e);
  }

  const memories: { window_start: string; window_end: string; url_host: string; summary_text: string }[] = [];
  for (const [host, hostEvents] of byHost) {
    const typeCounts: Record<string, number> = {};
    const titles: string[] = [];
    const uiTexts: string[] = [];
    for (const e of hostEvents) {
      const t = e.type || "unknown";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      if (e.title && !titles.includes(e.title)) titles.push(e.title);
      const txt = (e.text_content || "").trim();
      if (txt && !uiTexts.includes(txt)) uiTexts.push(txt);
    }
    const topTitles = titles.slice(0, 3);
    const topTexts = uiTexts.slice(0, 5);
    const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    const lines = [
      `Domain: ${host}`,
      "Activity:",
      ...sortedTypes.map(([k, v]) => `- ${k}: ${v}`),
      ...(topTitles.length ? [`Top pages: ${topTitles.join(", ")}`] : []),
      ...(topTexts.length ? [`UI context: ${topTexts.join(", ")}`] : []),
    ];
    memories.push({
      window_start,
      window_end,
      url_host: host,
      summary_text: lines.join("\n"),
    });
  }
  return memories;
}
