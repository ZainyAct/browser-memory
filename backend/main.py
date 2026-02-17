import os
import time
from datetime import datetime, timedelta, timezone
from starlette.middleware.base import BaseHTTPMiddleware
import httpx
from starlette.requests import Request
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv

from db import supabase
from schemas import EventIn, BatchIn, SummarizeIn
from summarizer import summarize_events, safe_host

load_dotenv()

app = FastAPI(title="Browser Memory Store")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")


class ExtensionCORSMiddleware(BaseHTTPMiddleware):
    """Handle CORS preflight for extension origins before other middleware (returns 200 + headers)."""

    INGEST_PATHS = {"/ingest/event", "/ingest/batch"}

    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS" and request.url.path in self.INGEST_PATHS:
            origin = request.headers.get("origin") or "*"
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type",
                    "Access-Control-Max-Age": "86400",
                },
            )
        response = await call_next(request)
        # Add CORS headers to actual POST response for extension origins
        if request.url.path in self.INGEST_PATHS and request.method == "POST":
            origin = request.headers.get("origin")
            if origin and ("moz-extension://" in origin or "chrome-extension://" in origin):
                response.headers["Access-Control-Allow-Origin"] = origin
        return response


app.add_middleware(ExtensionCORSMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_origin_regex=r"^https?://localhost(:\d+)?$|^(chrome-extension|moz-extension)://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

def _retry_supabase_request(fn, max_attempts=3):
    """Retry a Supabase request on transient network errors (e.g. ReadError EAGAIN)."""
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except (httpx.ReadError, httpx.ConnectError, OSError) as e:
            last_exc = e
            if attempt < max_attempts - 1:
                time.sleep(0.25 * (attempt + 1))
    raise last_exc


def get_authed_client(auth_header: str):
    """
    Set the Supabase PostgREST session to use the request's JWT so RLS uses auth.uid().
    """
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth_header.split(" ", 1)[1].strip()

    # Attach JWT to PostgREST so RLS uses auth.uid()
    supabase.postgrest.session.headers["Authorization"] = f"Bearer {token}"
    return token

@app.get("/health")
def health():
    return {"ok": True}


def _cors_preflight_response(origin: str | None) -> Response:
    """Return 200 for CORS preflight; mirror Origin so extension requests succeed."""
    headers = {
        "Access-Control-Allow-Origin": origin or "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "86400",
    }
    return Response(status_code=200, headers=headers)


@app.options("/ingest/event")
def ingest_event_options(request: Request):
    return _cors_preflight_response(request.headers.get("origin"))


@app.options("/ingest/batch")
def ingest_batch_options(request: Request):
    return _cors_preflight_response(request.headers.get("origin"))


@app.post("/ingest/event")
def ingest_event(
    event: EventIn,
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)

    # Get user id from token via Supabase /auth/v1/user
    try:
        user = _retry_supabase_request(lambda: supabase.auth.get_user(token))
    except (httpx.ReadError, httpx.ConnectError, OSError) as e:
        print(f"[ingest] Supabase get_user failed: {e}")
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable") from e
    user_id = user.user.id

    # Log so you can confirm extension → backend is working
    print(f"[ingest] {event.type} | {event.url or '(no url)'} | user={user_id[:8]}...")

    payload = {
        "user_id": user_id,
        "type": event.type,
        "url": event.url,
        "title": event.title,
        "text_content": event.text_content,
        "selector": event.selector,
        "metadata": event.metadata,
    }

    try:
        res = _retry_supabase_request(lambda: supabase.table("events").insert(payload).execute())
    except (httpx.ReadError, httpx.ConnectError, OSError) as e:
        print(f"[ingest] Supabase insert failed: {e}")
        raise HTTPException(status_code=503, detail="Storage temporarily unavailable") from e
    if res.data is None:
        raise HTTPException(status_code=500, detail="Insert failed")
    return {"inserted": 1}

@app.post("/ingest/batch")
def ingest_batch(
    batch: BatchIn,
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)
    try:
        user = _retry_supabase_request(lambda: supabase.auth.get_user(token))
    except (httpx.ReadError, httpx.ConnectError, OSError) as e:
        print(f"[ingest/batch] Supabase get_user failed: {e}")
        raise HTTPException(status_code=503, detail="Auth service temporarily unavailable") from e
    user_id = user.user.id

    rows = []
    for e in batch.events:
        rows.append({
            "user_id": user_id,
            "type": e.type,
            "url": e.url,
            "title": e.title,
            "text_content": e.text_content,
            "selector": e.selector,
            "metadata": e.metadata,
        })

    if not rows:
        return {"inserted": 0}

    print(f"[ingest/batch] {len(rows)} events | user={user_id[:8]}...")
    try:
        res = _retry_supabase_request(lambda: supabase.table("events").insert(rows).execute())
    except (httpx.ReadError, httpx.ConnectError, OSError) as e:
        print(f"[ingest/batch] Supabase insert failed: {e}")
        raise HTTPException(status_code=503, detail="Storage temporarily unavailable") from e
    if res.data is None:
        raise HTTPException(status_code=500, detail="Batch insert failed")
    return {"inserted": len(res.data)}

@app.post("/summarize/run")
def summarize_run(
    body: SummarizeIn,
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id

    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=body.minutes)

    # Pull recent events
    res = (
        supabase.table("events")
        .select("*")
        .eq("user_id", user_id)
        .gte("created_at", start.isoformat())
        .order("created_at", desc=False)
        .limit(2000)
        .execute()
    )
    events = res.data or []
    if not events:
        return {"created_memories": 0, "reason": "no recent events"}

    memory_rows = summarize_events(events)
    for row in memory_rows:
        row["user_id"] = user_id

    ins = supabase.table("memories").insert(memory_rows).execute()
    if ins.data is None:
        raise HTTPException(status_code=500, detail="Memory insert failed")

    return {"created_memories": len(ins.data)}

@app.get("/search")
def search(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id

    # Use FTS RPC (search_memories) for proper full-text search
    try:
        res = supabase.rpc("search_memories", {"q": q, "lim": limit}).execute()
        return {"results": res.data or []}
    except Exception:
        # Fallback: ilike if RPC not available
        res = (
            supabase.table("memories")
            .select("*")
            .eq("user_id", user_id)
            .ilike("summary_text", f"%{q}%")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"results": res.data or []}

@app.get("/recent/memories")
def recent_memories(
    limit: int = Query(50, ge=1, le=200),
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id

    res = (
        supabase.table("memories")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"results": res.data or []}

@app.get("/recent/events")
def recent_events(
    limit: int = Query(100, ge=1, le=500),
    host: str | None = Query(None),
    authorization: str = Header(None)
):
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id

    fetch_limit = min(500, limit * 3) if host else limit
    res = (
        supabase.table("events")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(fetch_limit)
        .execute()
    )
    events = res.data or []
    if host:
        events = [e for e in events if safe_host(e.get("url")) == host][:limit]
    return {"results": events}


def _build_analytics_charts(events: list[dict]) -> dict:
    """Build chart data: by_type, by_host (top N), over_time (per day)."""
    from collections import defaultdict
    by_type: dict[str, int] = defaultdict(int)
    by_host: dict[str, int] = defaultdict(int)
    by_date: dict[str, int] = defaultdict(int)
    for e in events:
        by_type[e.get("type") or "unknown"] += 1
        h = safe_host(e.get("url")) or "unknown"
        by_host[h] += 1
        ts = e.get("created_at")
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                by_date[dt.strftime("%Y-%m-%d")] += 1
            except Exception:
                pass
    top_hosts = sorted(by_host.items(), key=lambda x: -x[1])[:20]
    return {
        "by_type": [{"type": k, "count": v} for k, v in sorted(by_type.items(), key=lambda x: -x[1])],
        "by_host": [{"host": h, "count": c} for h, c in top_hosts],
        "over_time": [{"date": d, "count": c} for d, c in sorted(by_date.items())],
    }


@app.get("/analytics/charts")
def analytics_charts(
    limit: int = Query(1000, ge=1, le=5000),
    authorization: str = Header(None)
):
    """Return chart data: actions by type, by host, and over time."""
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id
    res = (
        supabase.table("events")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    events = res.data or []
    return _build_analytics_charts(events)


def _build_workflow_graph(events: list[dict]) -> dict:
    """
    Build an actionable workflow graph from events.
    Nodes = unique hosts (domains); edges = transitions between hosts in time order.
    """
    from collections import defaultdict
    if not events:
        return {"nodes": [], "edges": []}
    # Sort by created_at ascending (chronological)
    sorted_events = sorted(events, key=lambda e: (e.get("created_at") or ""))
    # Unique hosts and per-host activity counts
    host_stats: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for e in sorted_events:
        host = safe_host(e.get("url")) or "unknown"
        host_stats[host][e.get("type", "unknown")] += 1
    # Edges: consecutive (prev_host -> curr_host) when host changes
    edges_count: dict[tuple[str, str], int] = defaultdict(int)
    prev_host = None
    for e in sorted_events:
        curr_host = safe_host(e.get("url")) or "unknown"
        if prev_host is not None and prev_host != curr_host:
            edges_count[(prev_host, curr_host)] += 1
        prev_host = curr_host
    # Build node list (id = host, label = host + optional summary)
    nodes = []
    for host, stats in host_stats.items():
        parts = [f"{t}:{c}" for t, c in sorted(stats.items(), key=lambda x: -x[1])[:3]]
        label = host if not parts else f"{host} ({', '.join(parts)})"
        nodes.append({
            "id": host,
            "label": label,
            "host": host,
            "stats": dict(stats),
        })
    # Build edge list
    edges = []
    for (src, tgt), count in edges_count.items():
        edges.append({
            "id": f"{src}->{tgt}",
            "source": src,
            "target": tgt,
            "count": count,
            "label": str(count) if count > 1 else None,
        })
    return {"nodes": nodes, "edges": edges}


@app.get("/workflow/graph")
def workflow_graph(
    limit: int = Query(500, ge=1, le=2000),
    authorization: str = Header(None)
):
    """Return workflow graph (nodes = hosts, edges = transitions) from recent events."""
    token = get_authed_client(authorization)
    user = supabase.auth.get_user(token)
    user_id = user.user.id
    res = (
        supabase.table("events")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    events = res.data or []
    return _build_workflow_graph(events)
