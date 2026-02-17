export interface Memory {
  id: string;
  created_at: string;
  window_start: string;
  window_end: string;
  url_host: string | null;
  summary_text: string;
}

export interface BrowserEvent {
  id: string;
  created_at: string;
  type: string;
  url: string | null;
  title: string | null;
  text_content: string | null;
  selector: string | null;
  metadata: Record<string, unknown>;
}

export type ViewTab = "search" | "recent-memories" | "recent-events" | "workflow" | "analytics";

export interface WorkflowNode {
  id: string;
  label: string;
  host: string;
  stats: Record<string, number>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  count: number;
  label: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface AnalyticsCharts {
  by_type: { type: string; count: number }[];
  by_host: { host: string; count: number }[];
  over_time: { date: string; count: number }[];
}
