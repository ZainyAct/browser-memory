"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
  LineChart,
  Line,
} from "recharts";
import type { AnalyticsCharts as AnalyticsChartsData } from "@/lib/types";

const CHART_COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f85149", "#a371f7", "#8b9cb3"];

export default function AnalyticsCharts({ data }: { data: AnalyticsChartsData | null }) {
  if (!data) return null;

  const hasAny =
    data.by_type.length > 0 || data.by_host.length > 0 || data.over_time.length > 0;
  if (!hasAny) {
    return (
      <div className="analytics-empty card">
        <p>No analytics data yet.</p>
        <p className="analytics-empty-hint">Use the extension while browsing to see charts.</p>
      </div>
    );
  }

  return (
    <div className="analytics-grid">
      {data.by_type.length > 0 && (
        <div className="card chart-card">
          <h3 className="chart-title">Actions by type</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.by_type} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="type" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                  labelStyle={{ color: "var(--text)" }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.by_host.length > 0 && (
        <div className="card chart-card">
          <h3 className="chart-title">Top hosts (by event count)</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.by_host}
                layout="vertical"
                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="host"
                  width={120}
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  tickFormatter={(v) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
                <Bar dataKey="count" fill="var(--success)" radius={[0, 4, 4, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.over_time.length > 0 && (
        <div className="card chart-card chart-card-wide">
          <h3 className="chart-title">Events over time</h3>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.over_time} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                  labelFormatter={(v) => v}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: "var(--accent)", r: 3 }}
                  name="Events"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.over_time.length > 0 && (
        <div className="card chart-card chart-card-wide">
          <h3 className="chart-title">Events over time (scatter)</h3>
          <div className="chart-wrap chart-wrap-tall">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  tickFormatter={(v) => v.slice(5)}
                  name="Date"
                />
                <YAxis
                  dataKey="count"
                  tick={{ fill: "var(--text-muted)", fontSize: 12 }}
                  name="Count"
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                  cursor={{ stroke: "var(--border)" }}
                />
                <Scatter data={data.over_time} fill="var(--accent)" name="Events">
                  {data.over_time.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
