"use client";

// dep graph via sigma.js — webgl renderer, reliable node click detection
// graphology for graph data, forceatlas2 for layout

import { useEffect, useCallback } from "react";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
  useCamera,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { DepGraph, DepNode } from "@/lib/types";
import { getFileIconConfig } from "@/lib/fileIcons";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

function nodeBaseColor(node: DepNode): string {
  if (node.is_gitignored) return "#F59E0B";
  if (!node.is_file)       return "#9B72CF";
  if (!node.rel_path || node.description === "External dependency") return "#9B72CF";
  return getFileIconConfig(node.name).color;
}

interface GraphViewProps {
  data: DepGraph;
  onNodeSelect: (node: DepNode) => void;
  selectedIds?: string[];
}

// ── graph loader — runs inside SigmaContainer ────────────────────────────────

function GraphLoader({ data, onNodeSelect, selectedIds = [] }: GraphViewProps) {
  const loadGraph      = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const sigma          = useSigma();

  // build graph + pre-compute force layout on data change
  useEffect(() => {
    const graph = new Graph({ type: "directed", multi: false });

    const deg: Record<string, number> = {};
    for (const e of data.edges) {
      deg[e.from] = (deg[e.from] ?? 0) + 1;
      deg[e.to]   = (deg[e.to]   ?? 0) + 1;
    }

    data.nodes.forEach(n => {
      if (graph.hasNode(n.id)) return;
      const color = nodeBaseColor(n);
      graph.addNode(n.id, {
        label:         n.name,
        color,
        originalColor: color,
        size:  Math.max(4, Math.min(18, (deg[n.id] ?? 0) * 1.5 + 4)),
        x: Math.random() * 200 - 100,
        y: Math.random() * 200 - 100,
      });
    });

    data.edges.forEach(e => {
      if (!graph.hasNode(e.from) || !graph.hasNode(e.to)) return;
      if (graph.hasEdge(e.from, e.to)) return;
      graph.addDirectedEdge(e.from, e.to, { color: "#2a2a2a", size: 0.8 });
    });

    // pre-compute layout so nodes start stable
    forceAtlas2.assign(graph, {
      iterations: 200,
      settings:   forceAtlas2.inferSettings(graph),
    });

    loadGraph(graph);
  }, [data, loadGraph]);

  // update visual state when selection changes
  useEffect(() => {
    const graph = sigma.getGraph();
    if (graph.order === 0) return;
    const anySelected = selectedIds.length > 0;

    graph.forEachNode((id) => {
      const orig      = graph.getNodeAttribute(id, "originalColor") as string;
      const isSelected = selectedIds.includes(id);
      graph.setNodeAttribute(id, "color",
        !anySelected || isSelected ? orig : `${orig}33`
      );
    });

    graph.forEachEdge((edgeId, _attrs, src, tgt) => {
      const srcSel = selectedIds.includes(src);
      const tgtSel = selectedIds.includes(tgt);
      const isConn = selectedIds.length === 2 && srcSel && tgtSel;
      if (isConn) {
        graph.setEdgeAttribute(edgeId, "color", "#F59E0B");
        graph.setEdgeAttribute(edgeId, "size",  2.5);
      } else if (anySelected && (srcSel || tgtSel)) {
        graph.setEdgeAttribute(edgeId, "color", "#4F8EF7");
        graph.setEdgeAttribute(edgeId, "size",  1.5);
      } else {
        graph.setEdgeAttribute(edgeId, "color", "#2a2a2a");
        graph.setEdgeAttribute(edgeId, "size",  0.8);
      }
    });

    sigma.refresh();
  }, [selectedIds, sigma]);

  // node click → fire selection
  useEffect(() => {
    return registerEvents({
      clickNode: ({ node }) => {
        const depNode = data.nodes.find(n => n.id === node);
        if (depNode) onNodeSelect(depNode);
      },
    });
  }, [registerEvents, data.nodes, onNodeSelect]);

  return null;
}

// ── camera controls — runs inside SigmaContainer ─────────────────────────────

function CameraControls({ lastSelectedId }: { lastSelectedId?: string }) {
  const { zoomIn, zoomOut, reset, gotoNode } = useCamera({ duration: 300, factor: 1.5 });

  const center = useCallback(() => {
    if (lastSelectedId) gotoNode(lastSelectedId, { duration: 600 });
  }, [lastSelectedId, gotoNode]);

  const controls = [
    { icon: ZoomIn,    action: () => zoomIn(),  title: "zoom in"        },
    { icon: ZoomOut,   action: () => zoomOut(), title: "zoom out"       },
    { icon: RotateCcw, action: () => reset(),   title: "fit to screen"  },
    { icon: Crosshair, action: center,           title: "center selected", disabled: !lastSelectedId },
  ];

  return (
    <div className="absolute bottom-5 right-5 flex flex-col gap-1.5 z-10 pointer-events-auto">
      {controls.map(({ icon: Icon, action, title, disabled }) => (
        <button
          key={title}
          onClick={action}
          disabled={!!disabled}
          title={title}
          className={cn(
            "w-8 h-8 flex items-center justify-center rounded-lg transition-colors",
            "bg-[#111111] border border-[#1e1e1e] text-[#444]",
            "hover:border-[#333] hover:text-[#999]",
            "disabled:opacity-30 disabled:cursor-default"
          )}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}

// ── public export ─────────────────────────────────────────────────────────────

export function GraphView({ data, onNodeSelect, selectedIds = [] }: GraphViewProps) {
  const lastSelectedId = selectedIds[selectedIds.length - 1];

  return (
    <div className="relative w-full h-full bg-[#0c0c0c] overflow-hidden">
      <SigmaContainer
        style={{ width: "100%", height: "100%", background: "#0c0c0c" }}
        settings={{
          defaultNodeColor:           "#4F8EF7",
          defaultEdgeColor:           "#2a2a2a",
          labelColor:                 { color: "#666" },
          labelSize:                  11,
          labelWeight:                "normal",
          labelRenderedSizeThreshold: 8,
          renderEdgeLabels:           false,
        }}
      >
        <GraphLoader
          data={data}
          onNodeSelect={onNodeSelect}
          selectedIds={selectedIds}
        />
        <CameraControls lastSelectedId={lastSelectedId} />
      </SigmaContainer>

      {/* legend */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 bg-[#111111]/90 backdrop-blur-sm border border-[#1e1e1e] rounded-lg px-3 py-2.5 z-10">
        {[
          { color: "#4F8EF7", label: "source file" },
          { color: "#9B72CF", label: "external dep" },
          { color: "#F59E0B", label: "gitignored"   },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-[#555]">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-0.5 pt-1.5 border-t border-[#1a1a1a]">
          <span className="w-4 h-px shrink-0 rounded" style={{ background: "#F59E0B" }} />
          <span className="text-[10px] text-[#444]">connection</span>
        </div>
      </div>

      {/* stats */}
      <div className="absolute top-3 right-3 flex items-center gap-3 text-[10px] text-[#333] font-mono z-10">
        <span>{data.nodes.length} nodes</span>
        <span>{data.edges.length} edges</span>
      </div>
    </div>
  );
}
