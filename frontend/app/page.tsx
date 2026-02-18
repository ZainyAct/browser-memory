"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  supabase,
  isConfigured,
  setRuntimeSupabaseConfig,
  getSupabaseUrl,
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

function SetupScreen({ onConfigured }: { onConfigured: () => void }) {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const u = url.trim();
    const k = anonKey.trim();
    if (!u || !k) {
      setError("Please enter both Supabase URL and anon key.");
      return;
    }
    if (!u.startsWith("https://") || !u.includes("supabase")) {
      setError("URL should look like https://xxxx.supabase.co");
      return;
    }
    setRuntimeSupabaseConfig(u, k);
    onConfigured();
  };

  return (
    <div className="login-wrap">
      <div className="login-card card setup-card">
        <h1 className="login-title">Browser Memory Store</h1>
        <p className="login-subtitle">
          This demo is not configured. To let others use it from GitHub Pages with your Supabase project:
        </p>
        <ol style={{ textAlign: "left", color: "var(--text-muted)", margin: "0 0 20px", paddingLeft: 20, fontSize: 14 }}>
          <li>In this repo: <strong>Settings → Secrets and variables → Actions</strong>.</li>
          <li>Add <code>NEXT_PUBLIC_SUPABASE_URL</code> (your project URL) and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (anon key).</li>
          <li>Push to <code>main</code> or run <strong>Actions → Deploy to GitHub Pages</strong>. The live site will use your Supabase so visitors can sign in and try the app.</li>
        </ol>
        <p className="login-subtitle" style={{ marginTop: 16, marginBottom: 8 }}>
          Or use your own project (stored in your browser only):
        </p>
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <input
            type="url"
            placeholder="Supabase URL (e.g. https://xxxx.supabase.co)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="login-input"
            style={{ marginBottom: 10 }}
            autoComplete="url"
          />
          <input
            type="password"
            placeholder="Supabase anon key"
            value={anonKey}
            onChange={(e) => setAnonKey(e.target.value)}
            className="login-input"
            style={{ marginBottom: 10 }}
            autoComplete="off"
          />
          {error && <p style={{ color: "var(--error)", fontSize: 14, marginBottom: 10 }}>{error}</p>}
          <button type="submit" className="login-btn">
            Use this project
          </button>
        </form>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          See the README for full setup (schema, Edge Functions).
        </p>
      </div>
    </div>
  );
}

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
  const [isSignUp, setIsSignUp] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  if (typeof window !== "undefined" && !isConfigured) {
    return (
      <SetupScreen onConfigured={() => window.location.reload()} />
    );
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => setLoggedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    setStatus(isSignUp ? "Creating account..." : "Logging in...");
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus(error.message);
        return;
      }
      if (data.user && !data.session) {
        setStatus("Check your email for the confirmation link.");
        return;
      }
      setStatus("Account created. Logged in.");
      return;
    }
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
      setShowExtensionModal(true);
    } else setStatus("Not logged in.");
  };

  const copyTokenFromModal = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      await navigator.clipboard.writeText(token);
      setStatus("Token copied. Paste it in the extension Options.");
    }
  };

  const sendUrlAndTokenToExtension = () => {
    const url = getSupabaseUrl();
    if (!url || url.includes("placeholder")) {
      setStatus("App is not configured with a Supabase URL.");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) {
        setStatus("Not logged in.");
        return;
      }
      window.postMessage(
        { type: "BROWSER_MEMORY_SET_CONFIG", url: url.replace(/\/$/, ""), token },
        window.location.origin
      );
      setStatus("Sent URL & token to extension. Open extension Options and click Save.");
    });
  };

  if (!loggedIn) {
    const isPending = status.startsWith("Logging") || status.startsWith("Creating");
    const isSuccess = status === "Logged in." || status === "Account created. Logged in." || status.includes("Check your email");
    return (
      <div className="login-wrap">
        <div className="login-card card">
          <h1 className="login-title">Browser Memory Store</h1>
          <p className="login-subtitle">
            {isSignUp ? "Create an account with your email" : "Sign in with your account"}
          </p>
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
            {isSignUp ? "Sign up" : "Sign in"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: 8, background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 14, cursor: "pointer", textDecoration: "underline" }}
            onClick={() => { setIsSignUp(!isSignUp); setStatus(""); }}
          >
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
          <p className={`status-message ${isPending ? "" : isSuccess ? "success" : "error"}`}>
            {status || "\u00a0"}
          </p>
        </div>
      </div>
    );
  }

  const memoriesToShow = activeTab === "search" ? searchResults : recentMemories;

  return (
    <div className="app-wrap">
      {showExtensionModal && (
        <div className="modal-overlay" onClick={() => setShowExtensionModal(false)} role="dialog" aria-modal="true" aria-labelledby="extension-modal-title">
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2 id="extension-modal-title" className="login-title" style={{ marginTop: 0 }}>Add the extension & token</h2>
            <section style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--text)" }}>1. Install the extension</h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}><strong>Firefox:</strong></p>
              <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <li>Open <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>about:debugging</code> in the address bar.</li>
                <li>Click <strong>This Firefox</strong>.</li>
                <li>Click <strong>Load Temporary Add-on</strong>.</li>
                <li>In the repo, open the <code>extension</code> folder and select <code>manifest.json</code>.</li>
              </ol>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 4 }}><strong>Chrome:</strong></p>
              <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Go to <code style={{ background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>chrome://extensions</code> → turn on <strong>Developer mode</strong> → <strong>Load unpacked</strong> → select the <code>extension</code> folder.</p>
            </section>
            <section style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--text)" }}>2. Connect the extension (using this app’s project)</h3>
              <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 10 }}>
                Click <strong>Send URL & token to extension</strong> below — the extension will get this app’s Supabase URL and your token. Then open the extension <strong>Options</strong> and click <strong>Save</strong>. You don’t need to enter the URL manually.
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                Or paste the token yourself: copy it below, open extension Options, enter the Supabase URL and token, then Save.
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 0 }}>
                Tokens expire after about an hour. If the extension gets 401 errors, open this page again and click &quot;Send URL & token to extension&quot; (or copy a new token and Save in Options).
              </p>
            </section>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn-primary" onClick={sendUrlAndTokenToExtension}>
                Send URL & token to extension
              </button>
              <button type="button" className="btn-secondary" onClick={copyTokenFromModal}>
                Copy token
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowExtensionModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
