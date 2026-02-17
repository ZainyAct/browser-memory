"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  supabase,
  isConfigured,
  searchMemories,
  getRecentMemories,
  getRecentEvents,
  runSummarize,
  getWorkflowGraph,
  getAnalyticsCharts,
} from "@/lib/api";
import type { Memory, BrowserEvent, ViewTab, WorkflowGraph, AnalyticsCharts } from "@/lib/types";

const WorkflowGraphView = dynamic(() => import("@/app/components/WorkflowGraph"), { ssr: false });
const AnalyticsChartsView = dynamic(() => import("@/app/components/AnalyticsCharts"), { ssr: false });

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Memory[]>([]);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [recentEvents, setRecentEvents] = useState<BrowserEvent[]>([]);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [workflowSelectedHost, setWorkflowSelectedHost] = useState<string | null>(null);
  const [eventsForHost, setEventsForHost] = useState<BrowserEvent[]>([]);
  const [analyticsCharts, setAnalyticsCharts] = useState<AnalyticsCharts | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("search");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  if (typeof window !== "undefined" && !isConfigured) {
    return (
      <div className="login-wrap">
        <div className="login-card card setup-card">
          <h1 className="login-title">Browser Memory Store</h1>
          <p className="login-subtitle">
            This demo is not configured. To use it yourself:
          </p>
          <ol style={{ textAlign: "left", color: "var(--text-muted)", margin: "0 0 20px", paddingLeft: 20 }}>
            <li>Fork or clone the <a href="https://github.com" style={{ color: "var(--accent)" }}>repo</a>.</li>
            <li>Create a Supabase project and run <code>supabase/schema.sql</code>.</li>
            <li>Deploy the backend (e.g. Render, Railway) or run it locally.</li>
            <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, and <code>NEXT_PUBLIC_API_BASE</code> in your frontend env, then build and deploy.</li>
          </ol>
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            See the README in the repository for full setup.
          </p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => setLoggedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    setStatus("Logging in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? error.message : "Logged in.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSearchResults([]);
    setRecentMemories([]);
    setRecentEvents([]);
    setWorkflowGraph(null);
    setWorkflowSelectedHost(null);
    setEventsForHost([]);
    setAnalyticsCharts(null);
    setQuery("");
    setStatus("");
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) {
      setStatus("Enter a search term.");
      return;
    }
    setLoading(true);
    setStatus("Searching...");
    try {
      const results = await searchMemories(q, 20);
      setSearchResults(results);
      setStatus(`Found ${results.length} memor${results.length === 1 ? "y" : "ies"}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  };

  const loadRecentMemories = useCallback(async () => {
    setLoading(true);
    setStatus("Loading recent memories...");
    try {
      const results = await getRecentMemories(50);
      setRecentMemories(results);
      setStatus(`${results.length} recent memor${results.length === 1 ? "y" : "ies"}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecentEvents = useCallback(async () => {
    setLoading(true);
    setStatus("Loading recent events...");
    try {
      const results = await getRecentEvents(100);
      setRecentEvents(results);
      setStatus(`${results.length} recent events.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkflowGraph = useCallback(async () => {
    setLoading(true);
    setStatus("Building workflow graph...");
    try {
      const graph = await getWorkflowGraph(500);
      setWorkflowGraph(graph);
      const n = graph.nodes.length;
      const e = graph.edges.length;
      setStatus(`Workflow: ${n} step${n !== 1 ? "s" : ""}, ${e} transition${e !== 1 ? "s" : ""}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load workflow.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalyticsCharts = useCallback(async () => {
    setLoading(true);
    setStatus("Loading analytics...");
    try {
      const charts = await getAnalyticsCharts(1000);
      setAnalyticsCharts(charts);
      setStatus("Analytics loaded.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWorkflowNodeClick = useCallback(async (host: string) => {
    setWorkflowSelectedHost(host);
    setStatus(`Loading events for ${host}...`);
    try {
      const events = await getRecentEvents(100, host);
      setEventsForHost(events);
      setStatus(`${events.length} events on ${host}.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load events.");
      setEventsForHost([]);
    }
  }, []);

  const handleExportWorkflow = useCallback(() => {
    if (!workflowGraph) return;
    const blob = new Blob([JSON.stringify(workflowGraph, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-graph-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Workflow exported as JSON.");
  }, [workflowGraph]);

  useEffect(() => {
    if (!loggedIn) return;
    if (activeTab === "recent-memories") loadRecentMemories();
    else if (activeTab === "recent-events") loadRecentEvents();
    else if (activeTab === "workflow") loadWorkflowGraph();
    else if (activeTab === "analytics") loadAnalyticsCharts();
  }, [loggedIn, activeTab, loadRecentMemories, loadRecentEvents, loadWorkflowGraph, loadAnalyticsCharts]);

  const handleSummarize = async () => {
    setLoading(true);
    setStatus("Summarizing last 20 minutes...");
    try {
      const out = await runSummarize(20);
      setStatus(`Created ${out.created_memories} memor${out.created_memories === 1 ? "y" : "ies"}. ${out.reason ?? ""}`);
      if (activeTab === "recent-memories") loadRecentMemories();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Summarize failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      await navigator.clipboard.writeText(token);
      setStatus("Access token copied. Paste it in the extension Options.");
    } else setStatus("Not logged in.");
  };

  if (!loggedIn) {
    return (
      <div className="login-wrap">
        <div className="login-card card">
          <h1 className="login-title">Browser Memory Store</h1>
          <p className="login-subtitle">Sign in with your Supabase account</p>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-label="Password"
          />
          <button type="button" className="btn-primary login-btn" onClick={handleLogin}>
            Sign in
          </button>
          <p className={`status-message ${status.startsWith("Logging") ? "" : status === "Logged in." ? "success" : "error"}`}>
            {status || "\u00a0"}
          </p>
        </div>
      </div>
    );
  }

  const memoriesToShow = activeTab === "search" ? searchResults : recentMemories;

  return (
    <div className="app-wrap">
      <header className="app-header">
        <h1 className="app-title">Browser Memory Store</h1>
        <div className="app-actions">
          <button type="button" className="btn-secondary" onClick={copyToken}>
            Copy token for extension
          </button>
          <button type="button" className="btn-secondary" onClick={handleSummarize} disabled={loading}>
            Summarize last 20m
          </button>
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          type="button"
          className="tab"
          data-active={activeTab === "search"}
          onClick={() => setActiveTab("search")}
        >
          Search
        </button>
        <button
          type="button"
          className="tab"
          data-active={activeTab === "recent-memories"}
          onClick={() => setActiveTab("recent-memories")}
        >
          Recent memories
        </button>
        <button
          type="button"
          className="tab"
          data-active={activeTab === "recent-events"}
          onClick={() => setActiveTab("recent-events")}
        >
          Recent events
        </button>
        <button
          type="button"
          className="tab"
          data-active={activeTab === "workflow"}
          onClick={() => setActiveTab("workflow")}
        >
          Workflow graph
        </button>
        <button
          type="button"
          className="tab"
          data-active={activeTab === "analytics"}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </button>
      </div>

      {activeTab === "search" && (
        <div className="search-bar">
          <input
            type="search"
            placeholder="Search memories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            aria-label="Search memories"
          />
          <button type="button" className="btn-primary" onClick={handleSearch} disabled={!query.trim() || loading}>
            Search
          </button>
        </div>
      )}

      <p className={`status-message ${status.includes("Failed") || status.includes("Error") ? "error" : ""}`}>
        {status || "\u00a0"}
      </p>

      {activeTab === "recent-events" && (
        <div className="list-wrap">
          {recentEvents.length === 0 && !loading && (
            <p className="status-message">No events yet. Use the extension while browsing, then run Summarize.</p>
          )}
          {recentEvents.map((ev) => (
            <div key={ev.id} className="card event-card">
              <div className="card-head">
                <span className="badge">{ev.type}</span>
                <span className="card-date">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
              {ev.url && <p className="event-url">{ev.url}</p>}
              {(ev.title || ev.text_content) && (
                <p className="event-detail">{[ev.title, ev.text_content].filter(Boolean).join(" — ")}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {(activeTab === "search" || activeTab === "recent-memories") && (
        <div className="list-wrap">
          {memoriesToShow.length === 0 && !loading && activeTab === "search" && (
            <p className="status-message">Enter a search term and click Search.</p>
          )}
          {memoriesToShow.length === 0 && !loading && activeTab === "recent-memories" && (
            <p className="status-message">No memories yet. Run &quot;Summarize last 20m&quot; after browsing with the extension.</p>
          )}
          {memoriesToShow.map((m) => (
            <div key={m.id} className="card memory-card">
              <div className="card-head">
                <strong>{m.url_host ?? "unknown"}</strong>
                <span className="card-date">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              <pre className="memory-summary">{m.summary_text}</pre>
            </div>
          ))}
        </div>
      )}

      {activeTab === "workflow" && (
        <>
          <WorkflowGraphView
            data={workflowGraph}
            onNodeClick={handleWorkflowNodeClick}
            onExport={handleExportWorkflow}
          />
          {workflowSelectedHost && (
            <div className="workflow-events-panel card">
              <h4>
                Events for {workflowSelectedHost}
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setWorkflowSelectedHost(null);
                    setEventsForHost([]);
                  }}
                >
                  Clear
                </button>
              </h4>
              <div className="list-wrap">
                {eventsForHost.length === 0 && <p className="status-message">No events for this host.</p>}
                {eventsForHost.slice(0, 25).map((ev) => (
                  <div key={ev.id} className="event-card card">
                    <div className="card-head">
                      <span className="badge">{ev.type}</span>
                      <span className="card-date">{new Date(ev.created_at).toLocaleString()}</span>
                    </div>
                    {ev.url && <p className="event-url">{ev.url}</p>}
                    {(ev.title || ev.text_content) && (
                      <p className="event-detail">{[ev.title, ev.text_content].filter(Boolean).join(" — ")}</p>
                    )}
                  </div>
                ))}
                {eventsForHost.length > 25 && (
                  <p className="status-message">Showing 25 of {eventsForHost.length}.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "analytics" && <AnalyticsChartsView data={analyticsCharts} />}
    </div>
  );
}
