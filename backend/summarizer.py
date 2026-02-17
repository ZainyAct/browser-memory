from urllib.parse import urlparse
from collections import defaultdict
from datetime import datetime, timedelta, timezone

def safe_host(url: str | None) -> str | None:
    if not url:
        return None
    try:
        return urlparse(url).netloc or None
    except Exception:
        return None

def summarize_events(events: list[dict]) -> list[dict]:
    """
    Returns a list of memory rows to insert:
    [
      { window_start, window_end, url_host, summary_text }
    ]
    Strategy:
      - Group by host
      - Count event types
      - Pull top titles + key UI texts (button text / labels)
    """
    if not events:
        return []

    # Determine time window
    times = [datetime.fromisoformat(e["created_at"].replace("Z", "+00:00")) for e in events if e.get("created_at")]
    window_start = min(times)
    window_end = max(times)

    by_host = defaultdict(list)
    for e in events:
        host = safe_host(e.get("url")) or "unknown"
        by_host[host].append(e)

    memories = []
    for host, host_events in by_host.items():
        type_counts = defaultdict(int)
        titles = []
        ui_texts = []

        for e in host_events:
            type_counts[e.get("type", "unknown")] += 1
            t = e.get("title")
            if t and t not in titles:
                titles.append(t)
            txt = e.get("text_content")
            if txt and txt.strip():
                ui_texts.append(txt.strip())

        top_titles = titles[:3]
        top_texts = []
        for x in ui_texts:
            if x not in top_texts:
                top_texts.append(x)
            if len(top_texts) >= 5:
                break

        summary_lines = []
        summary_lines.append(f"Domain: {host}")
        summary_lines.append("Activity:")
        for k, v in sorted(type_counts.items(), key=lambda kv: -kv[1]):
            summary_lines.append(f"- {k}: {v}")

        if top_titles:
            summary_lines.append(f"Top pages: {', '.join(top_titles)}")

        if top_texts:
            summary_lines.append(f"UI context: {', '.join(top_texts)}")

        summary_text = "\n".join(summary_lines)

        memories.append({
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "url_host": host,
            "summary_text": summary_text
        })

    return memories
