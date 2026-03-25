"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import type { TreeNode, DepGraph, DepNode } from "@/lib/types";
import { FileTree } from "@/components/FileTree";
import { MarkdownPanel } from "@/components/MarkdownPanel";
import { DescriptionCardGrid } from "@/components/DescriptionCardGrid";
import { GraphView } from "@/components/GraphView";
import { GraphNodePanel } from "@/components/GraphNodePanel";
import { RefreshCw, Layers, FileText, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

const API_BASE = "http://localhost:8090";

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
  const [selectedTreeNode,  setSelectedTreeNode]  = useState<TreeNode | null>(null);
  const [selectedGraphNode, setSelectedGraphNode] = useState<DepNode  | null>(null);
  // track which source populated the right panel
  const [rightSource, setRightSource] = useState<"tree" | "graph">("tree");

  // ── fetch tree ────────────────────────────────────────────
  const fetchTree = useCallback(async () => {
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
    const interval = setInterval(fetchTree, 30000);
    return () => clearInterval(interval);
  }, [fetchTree]);

  // ── fetch dep graph — only when graph tab first opened ────
  const fetchGraph = useCallback(async () => {
    if (graphData) return; // already loaded
    setGraphLoading(true);
    setGraphError(null);
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
    setSelectedGraphNode(node);
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
      <header className="flex items-center justify-between px-5 h-11 bg-[#111111] border-b border-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#4F8EF7]/15 border border-[#4F8EF7]/25">
            <Layers size={13} className="text-[#4F8EF7]" />
          </div>
          <span className="text-[13px] font-semibold text-[#e2e2e2] tracking-tight">DGAT</span>
          <span className="text-[11px] text-[#333] select-none">·</span>
          <span className="text-[11px] text-[#555]">Dependency Graph as a Tool</span>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchTree(); }}
          className={cn(
            "flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md transition-all",
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
            <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#3a3a3a]">
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

          {/* tab header */}
          <div className="flex items-center gap-1 px-4 h-11 border-b border-[#1e1e1e] shrink-0">
            <button
              onClick={() => handleTabSwitch("blueprint")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                midTab === "blueprint"
                  ? "bg-[#1a1a1a] text-[#c0c0c0] border border-[#272727]"
                  : "text-[#444] hover:text-[#888] hover:bg-[#161616]"
              )}
            >
              <FileText size={11} />
              Blueprint
            </button>
            <button
              onClick={() => handleTabSwitch("graph")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all",
                midTab === "graph"
                  ? "bg-[#1a1a1a] text-[#c0c0c0] border border-[#272727]"
                  : "text-[#444] hover:text-[#888] hover:bg-[#161616]"
              )}
            >
              <GitBranch size={11} />
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
                selectedId={selectedGraphNode?.id}
              />
            ) : null}
          </div>
        </section>

        {/* ── Col 3: Inspector ─────────────────────────────── */}
        {/* shows tree card grid or graph node panel depending on what was last clicked */}
        <section className="flex-[4] overflow-hidden min-w-0 bg-[#0c0c0c]">
          {rightSource === "graph" ? (
            <GraphNodePanel node={selectedGraphNode} />
          ) : (
            <DescriptionCardGrid selectedNode={selectedTreeNode} />
          )}
        </section>

      </div>
    </div>
  );
}
