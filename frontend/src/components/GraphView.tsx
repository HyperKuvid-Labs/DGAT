"use client";

// force-directed dep graph — renders nodes colored by file extension
// clicking a node fires onNodeSelect so the right panel can show the full card

import { useRef, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DepGraph, DepNode } from "@/lib/types";
import { getFileIconConfig } from "@/lib/fileIcons";
import { ZoomIn, ZoomOut, RotateCcw, Crosshair, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

// dynamic import — canvas doesn't work in SSR
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader size={18} className="text-[#333] animate-spin" />
    </div>
  ),
});

interface GraphViewProps {
  data: DepGraph;
  onNodeSelect: (node: DepNode) => void;
  selectedId?: string;
}

// resolve a node's display color based on type + extension
function nodeColor(node: DepNode): string {
  if (node.is_gitignored) return "#F59E0B";
  if (!node.is_file) return "#9B72CF";
  // external deps (not in source tree) get purple
  if (!node.rel_path || node.description === "External dependency") return "#9B72CF";
  return getFileIconConfig(node.name).color;
}

export function GraphView({ data, onNodeSelect, selectedId }: GraphViewProps) {
  const fgRef = useRef<any>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // build the graph data format react-force-graph-2d expects
  const graphData = useMemo(() => {
    const degreemap: Record<string, number> = {};
    for (const e of data.edges) {
      degreemap[e.from] = (degreemap[e.from] ?? 0) + 1;
      degreemap[e.to]   = (degreemap[e.to]   ?? 0) + 1;
    }

    const nodes = data.nodes.map((n) => ({
      ...n,
      // val controls circle radius
      val: Math.max(2, Math.min(12, (degreemap[n.id] ?? 0) + 3)),
      color: nodeColor(n),
    }));

    const links = data.edges.map((e) => ({
      source: e.from,
      target: e.to,
      import_stmt: e.import_stmt,
    }));

    return { nodes, links };
  }, [data]);

  // custom canvas painter — circle + filename label underneath
  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const r = Math.sqrt(node.val) * 3;
      const isSelected = node.id === selectedId;
      const isHovered  = node.id === hoveredId;

      // glow ring for selected / hovered
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI);
        ctx.fillStyle = isSelected ? `${node.color}40` : `${node.color}25`;
        ctx.fill();
      }

      // main circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected || isHovered ? node.color : `${node.color}bb`;
      ctx.fill();

      // label — only when zoomed in enough
      if (globalScale >= 1.2 || isSelected || isHovered) {
        const label = node.name;
        const fontSize = Math.max(3, 10 / globalScale);
        ctx.font = `${fontSize}px "Inter", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isSelected || isHovered ? "#e2e2e2" : "#666";
        ctx.fillText(label, node.x, node.y + r + 2);
      }
    },
    [selectedId, hoveredId]
  );

  const handleNodeClick = useCallback(
    (node: any) => {
      // find original DepNode by id and pass it up
      const depNode = data.nodes.find((n) => n.id === node.id);
      if (depNode) onNodeSelect(depNode);
    },
    [data.nodes, onNodeSelect]
  );

  const handleNodeHover = useCallback((node: any) => {
    setHoveredId(node?.id ?? null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  const linkColor = useCallback(
    (link: any) => {
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (
        hoveredId && (src === hoveredId || tgt === hoveredId) ||
        selectedId && (src === selectedId || tgt === selectedId)
      ) {
        return "#4F8EF7";
      }
      return "#232323";
    },
    [hoveredId, selectedId]
  );

  const linkWidth = useCallback(
    (link: any) => {
      const src = typeof link.source === "object" ? link.source.id : link.source;
      const tgt = typeof link.target === "object" ? link.target.id : link.target;
      if (
        hoveredId && (src === hoveredId || tgt === hoveredId) ||
        selectedId && (src === selectedId || tgt === selectedId)
      ) return 1.5;
      return 0.5;
    },
    [hoveredId, selectedId]
  );

  // control helpers
  const zoomIn  = () => fgRef.current?.zoom(fgRef.current.zoom() * 1.4, 200);
  const zoomOut = () => fgRef.current?.zoom(fgRef.current.zoom() / 1.4, 200);
  const reset   = () => fgRef.current?.zoomToFit(400, 40);
  const center  = () => {
    if (!selectedId || !fgRef.current) return;
    const n = graphData.nodes.find((n: any) => n.id === selectedId) as any;
    if (n?.x !== undefined) {
      fgRef.current.centerAt(n.x, n.y, 600);
      fgRef.current.zoom(2, 600);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0c0c0c] overflow-hidden">
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#0c0c0c"
        nodeCanvasObject={paintNode}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.88}
        linkDirectionalArrowColor={linkColor}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.35}
        nodeLabel={(n: any) => `${n.name}\n${n.rel_path ?? ""}`}
      />

      {/* ── zoom controls ── */}
      <div className="absolute bottom-5 right-5 flex flex-col gap-1.5">
        {[
          { icon: ZoomIn,    action: zoomIn,  title: "zoom in"        },
          { icon: ZoomOut,   action: zoomOut, title: "zoom out"       },
          { icon: RotateCcw, action: reset,   title: "fit to screen"  },
          { icon: Crosshair, action: center,  title: "center selected", disabled: !selectedId },
        ].map(({ icon: Icon, action, title, disabled }) => (
          <button
            key={title}
            onClick={action}
            disabled={disabled}
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

      {/* ── legend ── */}
      <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 bg-[#111111]/80 backdrop-blur-sm border border-[#1e1e1e] rounded-lg px-3 py-2.5">
        {[
          { color: "#4F8EF7", label: "source file"  },
          { color: "#9B72CF", label: "external dep"  },
          { color: "#F59E0B", label: "gitignored"    },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span className="text-[10px] text-[#555]">{label}</span>
          </div>
        ))}
      </div>

      {/* ── stats ── */}
      <div className="absolute top-3 right-3 flex items-center gap-3 text-[10px] text-[#333] font-mono">
        <span>{data.nodes.length} nodes</span>
        <span>{data.edges.length} edges</span>
      </div>
    </div>
  );
}
