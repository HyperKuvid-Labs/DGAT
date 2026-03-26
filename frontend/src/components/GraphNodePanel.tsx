"use client";

import ReactMarkdown from "react-markdown";
import type { DepNode, DepEdge, DepGraph } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getFileIconConfig, getIconBadgeStyle } from "@/lib/fileIcons";
import { Folder, ArrowDown, ArrowUp, GitBranch, Hash } from "lucide-react";

// ── color helper (shared with GraphView) ─────────────────────────────────────

function nodeColor(node: DepNode): string {
  if (node.is_gitignored) return "#F59E0B";
  if (!node.is_file)       return "#9B72CF";
  if (!node.rel_path || node.description === "External dependency") return "#9B72CF";
  return getFileIconConfig(node.name).color;
}

function isPlaceholder(d?: string) {
  return !d || d === "Source file" || d === "External dependency" || d === "Gitignored dependency";
}

// ── GraphNodePanel ────────────────────────────────────────────────────────────
// 0 nodes  → empty state
// 1 node   → full single-node card
// 2 nodes  → side-by-side dual card

interface GraphNodePanelProps {
  nodes: DepNode[];
}

export function GraphNodePanel({ nodes }: GraphNodePanelProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
        <div className="w-11 h-11 rounded-2xl bg-[#141414] border border-[#1a1a1a] flex items-center justify-center">
          <GitBranch size={18} className="text-[#252525]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[14px] font-medium text-[#333]">no node selected</p>
          <p className="text-[12.5px] text-[#252525]">click a node in the graph</p>
        </div>
      </div>
    );
  }

  if (nodes.length === 1) {
    return <SingleNodeView node={nodes[0]} />;
  }

  // two nodes — side-by-side
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-hidden border-r border-[#1e1e1e]">
        <SingleNodeView node={nodes[0]} compact />
      </div>
      <div className="flex-1 overflow-hidden">
        <SingleNodeView node={nodes[1]} compact />
      </div>
    </div>
  );
}

// ── single node card ──────────────────────────────────────────────────────────

function SingleNodeView({ node, compact = false }: { node: DepNode; compact?: boolean }) {
  const depsOn  = node.depends_on  ?? [];
  const depsBy  = node.depended_by ?? [];
  const hasDesc = !isPlaceholder(node.description);
  const color   = nodeColor(node);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* header strip */}
      <div className="flex items-center justify-between px-3 h-11 border-b border-[#1e1e1e] shrink-0"
        style={{ background: `${color}08` }}>
        <div className="flex items-center gap-2 min-w-0">
          <NodeIconBadge node={node} size={12} />
          <span className="text-[13px] font-semibold truncate" style={{ color: `${color}cc` }}>
            {node.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {depsOn.length > 0 && (
            <span className="text-[11px] font-mono px-1 py-0.5 rounded-lg"
              style={{ background: "#4F8EF715", color: "#4F8EF770" }}>↓{depsOn.length}</span>
          )}
          {depsBy.length > 0 && (
            <span className="text-[11px] font-mono px-1 py-0.5 rounded-lg"
              style={{ background: "#F59E0B15", color: "#F59E0B70" }}>↑{depsBy.length}</span>
          )}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* meta */}
        <div className="space-y-1">
          {node.rel_path && (
            <p className="text-[11px] font-mono text-[#333] truncate">{node.rel_path}</p>
          )}
          {node.hash && (
            <p className="flex items-center gap-1 text-[10.5px] font-mono text-[#2a2a2a]">
              <Hash size={7} className="shrink-0" />
              {node.hash.slice(0, 12)}
            </p>
          )}
          <div className="flex items-center gap-1.5 pt-0.5">
            {node.is_gitignored && (
              <span className="text-[11px] px-1.5 py-px rounded-lg font-mono"
                style={{ background: "#F59E0B10", color: "#F59E0B70", border: "1px solid #F59E0B18" }}>
                gitignored
              </span>
            )}
            {!node.is_file && (
              <span className="text-[11px] px-1.5 py-px rounded-lg font-mono"
                style={{ background: "#9B72CF10", color: "#9B72CF70", border: "1px solid #9B72CF18" }}>
                external
              </span>
            )}
            {node.is_file && !node.is_gitignored && (
              <span className="text-[11px] px-1.5 py-px rounded-lg font-mono"
                style={{ background: "#4F8EF710", color: "#4F8EF760", border: "1px solid #4F8EF718" }}>
                source
              </span>
            )}
          </div>
        </div>

        {/* description — min height for 2-3 lines */}
        <div className="border-t border-[#1a1a1a] pt-2.5 min-h-[64px]">
          {hasDesc ? (
            <MiniMarkdown content={node.description} />
          ) : (
            <p className="text-[12.5px] italic text-[#2a2a2a] leading-[1.7]">
              {node.description || "no description available"}
            </p>
          )}
        </div>

        {/* dep pills — only in full (non-compact) view */}
        {!compact && depsOn.length > 0 && (
          <DepSection label="depends on" color="#4F8EF7" items={depsOn} icon={<ArrowDown size={9} />} />
        )}
        {!compact && depsBy.length > 0 && (
          <DepSection label="used by" color="#F59E0B" items={depsBy} icon={<ArrowUp size={9} />} />
        )}
      </div>
    </div>
  );
}

// ── GraphEdgePanel ────────────────────────────────────────────────────────────
// bottom section — mini node-graph + import stmt + relationship desc

interface GraphEdgePanelProps {
  edge: DepEdge | null;
  graphData: DepGraph | null;
  selectedNodes?: DepNode[];
}

export function GraphEdgePanel({ edge, graphData, selectedNodes = [] }: GraphEdgePanelProps) {

  const nodeA = selectedNodes[0] ?? (edge ? graphData?.nodes.find(n => n.id === edge.from) : null);
  const nodeB = selectedNodes[1] ?? (edge ? graphData?.nodes.find(n => n.id === edge.to)   : null);

  const hasEdge  = !!edge;
  const hasDesc  = !!edge?.description?.trim();
  const colorA   = nodeA ? nodeColor(nodeA) : "#4F8EF7";
  const colorB   = nodeB ? nodeColor(nodeB) : "#9B72CF";
  const nameA    = nodeA?.name ?? edge?.from.split("/").pop() ?? "A";
  const nameB    = nodeB?.name ?? edge?.to.split("/").pop()   ?? "B";

  // no nodes at all
  if (selectedNodes.length === 0 && !edge) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
        <p className="text-[12.5px] text-[#2e2e2e]">select two nodes to see their connection</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* mini node graph */}
      <div className="shrink-0 flex items-center justify-center px-6 py-4 border-b border-[#1a1a1a] bg-[#0e0e0e]">
        <MiniNodeGraph
          nameA={nameA} colorA={colorA}
          nameB={nameB} colorB={colorB}
          hasEdge={hasEdge}
          importStmt={edge?.import_stmt}
        />
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* import statement */}
        {edge && (
          <div>
            <p className="text-[11px] uppercase tracking-widest font-semibold mb-1.5"
              style={{ color: "#4F8EF780" }}>import</p>
            <code className="block text-[12px] font-mono bg-[#111] text-[#ce9178] px-3 py-2 rounded-lg border border-[#1e1e1e] break-all leading-[1.6]">
              {edge.import_stmt}
            </code>
          </div>
        )}

        {/* relationship */}
        <div>
          <p className="text-[11px] uppercase tracking-widest font-semibold mb-1.5"
            style={{ color: "#F59E0B80" }}>relationship</p>
          {hasDesc ? (
            <MiniMarkdown content={edge!.description} />
          ) : (
            <p className="text-[12.5px] italic text-[#2a2a2a] leading-[1.7] min-h-[64px]">
              {!hasEdge
                ? "no direct connection between these files"
                : "no relationship description — rebuild with vllm to generate"}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

// ── mini two-node SVG graph ───────────────────────────────────────────────────

function MiniNodeGraph({
  nameA, colorA, nameB, colorB, hasEdge, importStmt,
}: {
  nameA: string; colorA: string;
  nameB: string; colorB: string;
  hasEdge: boolean;
  importStmt?: string;
}) {
  const W = 280; const H = 90;
  const ax = 44;  const bx = W - 44; const cy = 42;
  const r  = 18;
  // arrow path
  const arrowX1 = ax + r + 4;
  const arrowX2 = bx - r - 4;
  const midX    = (arrowX1 + arrowX2) / 2;

  const trimImport = importStmt
    ? (importStmt.length > 28 ? importStmt.slice(0, 26) + "…" : importStmt)
    : null;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={hasEdge ? "#F59E0B" : "#333"} />
        </marker>
      </defs>

      {/* node A glow */}
      <circle cx={ax} cy={cy} r={r + 5} fill={`${colorA}18`} />
      {/* node A circle */}
      <circle cx={ax} cy={cy} r={r} fill={`${colorA}22`} stroke={colorA} strokeWidth="1.5" />
      {/* node A label */}
      <text x={ax} y={H - 6} textAnchor="middle" fill={colorA} fontSize="8" fontFamily="monospace"
        style={{ opacity: 0.8 }}>{nameA.length > 12 ? nameA.slice(0, 11) + "…" : nameA}</text>
      {/* node A ext */}
      <text x={ax} y={cy + 4} textAnchor="middle" fill={colorA} fontSize="8" fontFamily="monospace">
        {nameA.includes(".") ? `.${nameA.split(".").pop()}` : "?"}
      </text>

      {/* arrow */}
      <line
        x1={arrowX1} y1={cy} x2={arrowX2} y2={cy}
        stroke={hasEdge ? "#F59E0B" : "#2a2a2a"}
        strokeWidth={hasEdge ? 1.5 : 1}
        strokeDasharray={hasEdge ? "none" : "4 3"}
        markerEnd="url(#arrowhead)"
      />
      {/* import label on arrow */}
      {trimImport && (
        <text x={midX} y={cy - 6} textAnchor="middle" fill="#555" fontSize="7.5" fontFamily="monospace">
          {trimImport}
        </text>
      )}

      {/* node B glow */}
      <circle cx={bx} cy={cy} r={r + 5} fill={`${colorB}18`} />
      {/* node B circle */}
      <circle cx={bx} cy={cy} r={r} fill={`${colorB}22`} stroke={colorB} strokeWidth="1.5" />
      {/* node B label */}
      <text x={bx} y={H - 6} textAnchor="middle" fill={colorB} fontSize="8" fontFamily="monospace"
        style={{ opacity: 0.8 }}>{nameB.length > 12 ? nameB.slice(0, 11) + "…" : nameB}</text>
      {/* node B ext */}
      <text x={bx} y={cy + 4} textAnchor="middle" fill={colorB} fontSize="8" fontFamily="monospace">
        {nameB.includes(".") ? `.${nameB.split(".").pop()}` : "?"}
      </text>
    </svg>
  );
}

// ── dep section ───────────────────────────────────────────────────────────────

function DepSection({ label, color, items, icon }: {
  label: string; color: string; items: string[]; icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11.5px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5"
        style={{ color: `${color}99` }}>
        {icon}{label}
        <span className="ml-1 font-mono" style={{ color: `${color}55` }}>{items.length}</span>
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map(dep => (
          <div key={dep} className="rounded-lg border px-2.5 py-1.5"
            style={{ background: `${color}08`, borderColor: `${color}18` }}>
            <p className="text-[11.5px] font-mono truncate" style={{ color: `${color}99` }}>
              {dep.split("/").pop()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── mini markdown ─────────────────────────────────────────────────────────────

function MiniMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p:      ({ children }: any) => <p className="text-[13.5px] text-[#777] leading-[1.8] mb-2 last:mb-0">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strong: ({ children }: any) => <strong className="font-semibold text-[#aaa]">{children}</strong>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        em:     ({ children }: any) => <em className="italic text-[#666]">{children}</em>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ul:     ({ children }: any) => <ul className="mb-2 space-y-0.5 pl-0">{children}</ul>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        li:     ({ children }: any) => (
          <li className="flex items-start gap-2 text-[13px] text-[#666] leading-[1.7]">
            <span className="text-[#333] mt-[5px] shrink-0 text-[7px]">▸</span>
            <span>{children}</span>
          </li>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code:   ({ children }: any) => (
          <code className="text-[12px] font-mono bg-[#1a1a1a] text-[#ce9178] px-1 py-px rounded border border-[#222]">
            {children}
          </code>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h1: ({ children }: any) => <p className="text-[13.5px] font-semibold text-[#999] mb-1.5">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h2: ({ children }: any) => <p className="text-[13px] font-semibold text-[#888] mb-1">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h3: ({ children }: any) => <p className="text-[12px] font-semibold text-[#777] mb-1">{children}</p>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── icon badge ────────────────────────────────────────────────────────────────

function NodeIconBadge({ node, size = 14 }: { node: DepNode; size?: number }) {
  const pad = Math.round(size * 0.55);
  const box = size + pad * 2;
  if (!node.is_file) {
    return (
      <div className="flex items-center justify-center rounded-md shrink-0"
        style={{ width: box, height: box, background: "#9B72CF15", border: "1px solid #9B72CF28" }}>
        <Folder size={size} style={{ color: "#9B72CF" }} />
      </div>
    );
  }
  const cfg = getFileIconConfig(node.name);
  const Icon = cfg.icon;
  const badge = getIconBadgeStyle(cfg.color);
  return (
    <div className="flex items-center justify-center rounded-md shrink-0"
      style={{ width: box, height: box, ...badge }}>
      <Icon size={size} style={{ color: cfg.color }} />
    </div>
  );
}
