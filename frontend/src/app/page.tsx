"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import type { TreeNode, DepGraph, DepNode, StaticData } from "@/lib/types";
import dynamic from "next/dynamic";
import { FileTree } from "@/components/FileTree";
import { MarkdownPanel } from "@/components/MarkdownPanel";
import { DescriptionCardGrid } from "@/components/DescriptionCardGrid";
import { GraphNodePanel, GraphEdgePanel } from "@/components/GraphNodePanel";

// GraphView uses Sigma.js (WebGL) — must not run during SSR prerendering
const GraphView = dynamic(
  () => import("@/components/GraphView").then(m => m.GraphView),
  { ssr: false }
);
import { RefreshCw, Layers, FileText, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "http://localhost:8090";

/** Returns embedded static data injected by `dgat --export`, or undefined in live mode. */
function getStaticData(): StaticData | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { __DGAT_DATA__?: StaticData }).__DGAT_DATA__;
}

export default function Home() {
  const [treeData, setTreeData]   = useState<TreeNode | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // middle column tab
  const [midTab, setMidTab] = useState<"blueprint" | "graph">("blueprint");

  // graph data — lazy loaded when graph tab is first opened
  const [graphData, setGraphData]       = useState<DepGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError]     = useState<string | null>(null);

  // right panel — whichever was selected last wins
  const [selectedTreeNode,   setSelectedTreeNode]   = useState<TreeNode | null>(null);
  // up to 2 selected graph nodes — last click is "primary", previous is "secondary"
  const [selectedGraphNodes, setSelectedGraphNodes] = useState<DepNode[]>([]);
  // track which source populated the right panel
  const [rightSource, setRightSource] = useState<"tree" | "graph">("tree");

  // edge derived from the two selected nodes
  const derivedEdge = useMemo(() => {
    if (selectedGraphNodes.length < 2 || !graphData) return null;
    const [a, b] = selectedGraphNodes;
    return graphData.edges.find(e =>
      (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id)
    ) ?? null;
  }, [selectedGraphNodes, graphData]);

  // ── fetch tree ────────────────────────────────────────────
  const fetchTree = useCallback(async () => {
    const sd = getStaticData();
    if (sd) {
      setTreeData(sd.tree);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await axios.get<TreeNode>(`${API_BASE}/api/tree`);
      setTreeData(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
    if (getStaticData()) return; // no polling in static export mode
    const interval = setInterval(fetchTree, 30000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  // ── fetch dep graph — only when graph tab first opened ────
  const fetchGraph = useCallback(async () => {
    if (graphData) return; // already loaded
    setGraphLoading(true);
    setGraphError(null);
    const sd = getStaticData();
    if (sd) {
      setGraphData(sd.graph);
      setGraphLoading(false);
      return;
    }
    try {
      const res = await axios.get<DepGraph>(`${API_BASE}/api/dep-graph`);
      setGraphData(res.data);
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Failed to load graph");
    } finally {
      setGraphLoading(false);
    }
  }, [graphData]);

  const handleTabSwitch = (tab: "blueprint" | "graph") => {
    setMidTab(tab);
    if (tab === "graph") fetchGraph();
  };

  const handleTreeSelect = (node: TreeNode) => {
    setSelectedTreeNode(node);
    setRightSource("tree");
  };

  const handleGraphNodeSelect = (node: DepNode) => {
    setSelectedGraphNodes(prev => {
      // already selected → deselect
      if (prev.some(n => n.id === node.id)) return prev.filter(n => n.id !== node.id);
      // new node — keep last one + this, max 2
      return [...prev.slice(-1), node];
    });
    setRightSource("graph");
  };

  // ── loading / error screens ───────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0c0c]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#4F8EF7]/20 border-t-[#4F8EF7] rounded-full animate-spin mx-auto" />
          <p className="text-[12px] text-[#444]">Connecting to DGAT…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0c0c0c]">
        <div className="p-8 bg-[#111] border border-[#1e1e1e] rounded-2xl max-w-sm text-center space-y-3">
          <p className="text-[13px] text-red-400/80 font-medium">{error}</p>
          <p className="text-[11px] text-[#444]">
            Start the server:{" "}
            <code className="text-[#ce9178] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
              ./build/dgat --gui
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0c0c0c] text-[#d4d4d4] overflow-hidden font-sans">

      {/* ── Titlebar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 h-12 bg-[#111111] border-b border-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#4F8EF7]/15 border border-[#4F8EF7]/25">
            <Layers size={13} className="text-[#4F8EF7]" />
          </div>
          <span className="text-[14px] font-semibold text-[#e2e2e2] tracking-tight">DGAT</span>
          <span className="text-[12px] text-[#333] select-none">·</span>
          <span className="text-[12px] text-[#555]">Dependency Graph as a Tool</span>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchTree(); }}
          className={cn(
            "flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-md transition-all",
            "text-[#444] hover:text-[#aaa] hover:bg-[#1a1a1a] border border-transparent hover:border-[#222]"
          )}
        >
          <RefreshCw size={11} className={cn(refreshing && "animate-spin")} />
          Refresh
        </button>
      </header>

      {/* ── Three Columns ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Col 1: Explorer ──────────────────────────────── */}
        <aside className="w-[250px] shrink-0 flex flex-col bg-[#111111] border-r border-[#1e1e1e] overflow-hidden">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#3a3a3a]">
              Explorer
            </span>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {treeData ? (
              <FileTree
                data={treeData}
                onSelect={handleTreeSelect}
                selectedPath={selectedTreeNode?.rel_path}
              />
            ) : (
              <p className="px-4 text-[12px] text-[#333]">No data</p>
            )}
          </div>
        </aside>

        {/* ── Col 2: Blueprint / Graph ─────────────────────── */}
        <section className="flex-[3] border-r border-[#1e1e1e] overflow-hidden min-w-0 bg-[#0e0e0e] flex flex-col">

          {/* tab header — full width segmented toggle */}
          <div className="flex items-center px-3 h-12 border-b border-[#1e1e1e] shrink-0 gap-1.5">
            <button
              onClick={() => handleTabSwitch("blueprint")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all",
                midTab === "blueprint"
                  ? "bg-[#1e1e1e] text-[#d0d0d0] border border-[#2e2e2e]"
                  : "text-[#3a3a3a] hover:text-[#777] hover:bg-[#161616] border border-transparent"
              )}
            >
              <FileText size={12} />
              Blueprint
            </button>
            <button
              onClick={() => handleTabSwitch("graph")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-[13px] font-medium transition-all",
                midTab === "graph"
                  ? "bg-[#1e1e1e] text-[#d0d0d0] border border-[#2e2e2e]"
                  : "text-[#3a3a3a] hover:text-[#777] hover:bg-[#161616] border border-transparent"
              )}
            >
              <GitBranch size={12} />
              Graph
            </button>
          </div>

          {/* tab content */}
          <div className="flex-1 overflow-hidden">
            {midTab === "blueprint" ? (
              <MarkdownPanel
                filePath="dgat_blueprint.md"
                title="dgat_blueprint.md"
                apiBase=""
                staticContent={getStaticData()?.blueprint}
                className="h-full"
              />
            ) : graphLoading ? (
              <div className="flex items-center justify-center h-full gap-3">
                <div className="w-5 h-5 border-2 border-[#4F8EF7]/20 border-t-[#4F8EF7] rounded-full animate-spin" />
                <span className="text-[12px] text-[#444]">Loading graph…</span>
              </div>
            ) : graphError ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                <p className="text-[12px] text-red-400/60">{graphError}</p>
                <button
                  onClick={() => { setGraphData(null); fetchGraph(); }}
                  className="text-[11px] px-3 py-1.5 rounded-md bg-[#1a1a1a] hover:bg-[#222] text-[#666] border border-[#222] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : graphData ? (
              <GraphView
                data={graphData}
                onNodeSelect={handleGraphNodeSelect}
                selectedIds={selectedGraphNodes.map(n => n.id)}
              />
            ) : null}
          </div>
        </section>

        {/* ── Col 3: Inspector ─────────────────────────────── */}
        {/* tree: full-height card grid | graph: top = node panel, bottom = edge panel */}
        <section className="flex-[4] overflow-hidden min-w-0 bg-[#0c0c0c] flex flex-col">
          {rightSource === "graph" ? (
            <>
              {/* top ~55% — selected node(s), both shown when two are picked */}
              <div className="flex-[55] overflow-hidden min-h-0">
                <GraphNodePanel nodes={selectedGraphNodes} />
              </div>
              {/* bottom ~45% — mini graph + connection between the two nodes */}
              <div className="flex-[45] overflow-hidden min-h-0 border-t border-[#1e1e1e]">
                <GraphEdgePanel edge={derivedEdge} graphData={graphData} selectedNodes={selectedGraphNodes} />
              </div>
            </>
          ) : (
            <DescriptionCardGrid selectedNode={selectedTreeNode} />
          )}
        </section>

      </div>
    </div>
  );
}
