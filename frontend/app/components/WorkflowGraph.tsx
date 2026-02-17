"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import type { WorkflowGraph as WorkflowGraphData } from "@/lib/types";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

function getLayoutedElements(
  nodes: WorkflowGraphData["nodes"],
  edges: WorkflowGraphData["edges"]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph({ compound: true });
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  const layoutedNodes: Node[] = nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "workflow",
      data: { label: n.label, host: n.host, stats: n.stats },
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
  const layoutedEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    label: e.count > 1 ? String(e.count) : undefined,
    labelBgStyle: { fill: "var(--bg-elevated)" },
    labelStyle: { fill: "var(--text-muted)", fontSize: 11 },
    labelBgPadding: [4, 8] as [number, number],
    labelBgBorderRadius: 4,
  }));
  return { nodes: layoutedNodes, edges: layoutedEdges };
}

function WorkflowNode({ data }: NodeProps) {
  const stats = (data.stats as Record<string, number>) || {};
  const total = Object.values(stats).reduce((a, b) => a + b, 0);
  return (
    <div className="workflow-node">
      <Handle type="target" position={Position.Left} className="workflow-handle" />
      <div className="workflow-node-label">{data.label}</div>
      <div className="workflow-node-meta">{data.host} · {total} event{total !== 1 ? "s" : ""}</div>
      <Handle type="source" position={Position.Right} className="workflow-handle" />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode };

interface WorkflowGraphProps {
  data: WorkflowGraphData | null;
  onNodeClick?: (host: string) => void;
  onExport?: () => void;
}

export default function WorkflowGraph({ data, onNodeClick, onExport }: WorkflowGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useLayoutEffect(() => {
    if (!data?.nodes?.length) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(data.nodes, data.edges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  if (!data) return null;
  if (!data.nodes.length) {
    return (
      <div className="workflow-empty">
        <p>No workflow data yet.</p>
        <p className="workflow-empty-hint">Browse with the extension enabled, then return here to see your flow.</p>
      </div>
    );
  }

  return (
    <div className="workflow-section">
      <div className="workflow-toolbar">
        <button type="button" className="btn-secondary btn-sm" onClick={onExport}>
          Export graph (JSON)
        </button>
      </div>
      <div className="workflow-container">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} color="var(--border)" />
          <Controls className="workflow-controls" />
          <MiniMap
            className="workflow-minimap"
            nodeColor="var(--accent)"
            maskColor="rgba(15, 20, 25, 0.8)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
