"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import type { DepGraph, TreeNode } from "@/lib/types";
import { FileTree } from "@/components/FileTree";
import { DetailPanel } from "@/components/DetailPanel";
import { cn } from "@/lib/utils";
import { Network, Files, ZoomIn, ZoomOut, RotateCcw, MousePointer2, RefreshCw } from "lucide-react";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-2 border-[#5e5e5e] border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
});

const API_BASE = "http://localhost:8090";

export default function Home() {
  const [graphData, setGraphData] = useState<DepGraph>({ nodes: [], edges: [] });
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "tree">("graph");
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<TreeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const graphRef = useRef<any>(null);
  const graphDataCache = useRef<string>("");

  const fetchData = useCallback(async () => {
    try {
      const [graphRes, treeRes] = await Promise.all([
        axios.get<DepGraph>(`${API_BASE}/api/dep-graph`),
        axios.get<TreeNode>(`${API_BASE}/api/tree`),
      ]);

      const newGraphData = JSON.stringify(graphRes.data);
      const newTreeData = treeRes.data;

      // Only update if data actually changed
      if (graphDataCache.current !== newGraphData) {
        graphDataCache.current = newGraphData;
        setGraphData(graphRes.data);
      }
      
      setTreeData(newTreeData);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Refresh less frequently - every 30 seconds instead of 5
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleNodeClick = useCallback((node: any) => {
    if (node) {
      setSelectedNode(node.id || node.name);
    }
  }, []);

  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node?.id || null);
  }, []);

  const handleFileSelect = useCallback((file: TreeNode) => {
    setSelectedFile(file);
  }, []);

  const transformGraphData = useCallback(() => {
    const nodeDegrees: Record<string, number> = {};
    graphData.edges.forEach((e) => {
      nodeDegrees[e.from] = (nodeDegrees[e.from] || 0) + 1;
      nodeDegrees[e.to] = (nodeDegrees[e.to] || 0) + 1;
    });

    const nodes = graphData.nodes.map((n) => {
      const degree = nodeDegrees[n.id] || 0;
      return {
        id: n.id,
        name: n.name,
        rel_path: n.rel_path,
        group: n.is_file ? (n.is_gitignored ? "gitignored" : "source") : "external",
        degree,
        val: Math.max(3, Math.min(12, degree + 3)),
      };
    });

    const links = graphData.edges.map((e) => ({
      source: e.from,
      target: e.to,
      import_stmt: e.import_stmt,
    }));

    return { nodes, links };
  }, [graphData]);

  const graph2DData = useMemo(() => transformGraphData(), [transformGraphData]);

  const nodeColor = useCallback((node: any) => {
    if (node.id === hoveredNode) return "#3B82F6";
    if (node.group === "gitignored") return "#F59E0B";
    if (node.group === "external") return "#8B5CF6";
    return "#5E5E5E";
  }, [hoveredNode]);

  const linkColor = useCallback((link: any) => {
    if (hoveredNode && (link.source.id === hoveredNode || link.target.id === hoveredNode)) {
      return "#3B82F6";
    }
    return "#3a3a3a";
  }, [hoveredNode]);

  const linkWidth = useCallback((link: any) => {
    if (hoveredNode && (link.source.id === hoveredNode || link.target.id === hoveredNode)) {
      return 2;
    }
    return 1;
  }, [hoveredNode]);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() * 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoom(graphRef.current.zoom() / 1.3);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  }, []);

  const handleCenterSelected = useCallback(() => {
    if (graphRef.current && selectedNode) {
      const node = graph2DData.nodes.find((n: any) => n.id === selectedNode);
      if (node && (node as any).x !== undefined && (node as any).y !== undefined) {
        graphRef.current.centerAt((node as any).x, (node as any).y, 1000);
        graphRef.current.zoom(1.5, 1000);
      }
    }
  }, [selectedNode, graph2DData]);

  const handleManualRefresh = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const selectedGraphNode = useMemo(() => 
    graphData.nodes.find((n) => n.id === selectedNode), 
    [graphData.nodes, selectedNode]
  );

  const nodeEdges = useMemo(() => 
    graphData.edges.filter((e) => e.from === selectedNode || e.to === selectedNode),
    [graphData.edges, selectedNode]
  );

  if (loading && !graphData.nodes.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#5e5e5e] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#8b8b8b]">Loading DGAT...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1a1a1a]">
        <div className="text-center p-8 bg-[#252525] border border-[#3a3a3a] rounded-xl max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-[#8b8b8b] text-sm">
            Make sure the DGAT server is running: ./build/dgat --gui
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1a] text-[#e0e0e0]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#252525] border-b border-[#3a3a3a]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">DGAT</h1>
          <span className="text-xs text-[#8b8b8b]">Dependency Graph as a Tool</span>
        </div>

        <div className="flex items-center gap-2 bg-[#1a1a1a] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("graph")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "graph"
                ? "bg-[#5e5e5e] text-white"
                : "text-[#8b8b8b] hover:text-[#e0e0e0]"
            )}
          >
            <Network size={16} />
            Graph
          </button>
          <button
            onClick={() => setActiveTab("tree")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "tree"
                ? "bg-[#5e5e5e] text-white"
                : "text-[#8b8b8b] hover:text-[#e0e0e0]"
            )}
          >
            <Files size={16} />
            Tree
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#8b8b8b]">
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.edges.length} edges</span>
          <button
            onClick={handleManualRefresh}
            className="p-1 hover:bg-[#3a3a3a] rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Graph / Tree Panel */}
        <div className="flex-1 relative">
          {activeTab === "graph" ? (
            <>
              {graphData.nodes.length > 0 ? (
                <>
                  <ForceGraph2D
                    ref={graphRef}
                    graphData={graph2DData}
                    nodeLabel="name"
                    nodeColor={nodeColor}
                    nodeVal="val"
                    linkColor={linkColor}
                    linkWidth={linkWidth}
                    linkDirectionalArrowLength={4}
                    linkDirectionalArrowRelPos={0.9}
                    backgroundColor="#1a1a1a"
                    onNodeClick={handleNodeClick}
                    onNodeHover={handleNodeHover}
                    cooldownTicks={100}
                    d3AlphaDecay={0.02}
                    d3VelocityDecay={0.3}
                  />

                  {/* Graph Controls */}
                  <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                    <button
                      onClick={handleZoomIn}
                      className="p-3 bg-[#252525] border border-[#3a3a3a] rounded-lg hover:border-[#5e5e5e] transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn size={20} />
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="p-3 bg-[#252525] border border-[#3a3a3a] rounded-lg hover:border-[#5e5e5e] transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut size={20} />
                    </button>
                    <button
                      onClick={handleReset}
                      className="p-3 bg-[#252525] border border-[#3a3a3a] rounded-lg hover:border-[#5e5e5e] transition-colors"
                      title="Reset View"
                    >
                      <RotateCcw size={20} />
                    </button>
                    <button
                      onClick={handleCenterSelected}
                      className="p-3 bg-[#252525] border border-[#3a3a3a] rounded-lg hover:border-[#5e5e5e] transition-colors"
                      title="Center Selected"
                      disabled={!selectedNode}
                    >
                      <MousePointer2 size={20} />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="absolute bottom-6 left-6 bg-[#252525] border border-[#3a3a3a] rounded-lg p-4 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-[#5e5e5e]"></div>
                      <span className="text-[#8b8b8b]">Source File</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-[#8B5CF6]"></div>
                      <span className="text-[#8b8b8b]">External</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div>
                      <span className="text-[#8b8b8b]">Gitignored</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[#8b8b8b]">
                  No dependency graph data available
                </div>
              )}
            </>
          ) : (
            <div className="h-full overflow-auto p-4">
              {treeData ? (
                <FileTree
                  data={treeData}
                  onSelect={handleFileSelect}
                  selectedPath={selectedFile?.rel_path}
                />
              ) : (
                <div className="text-[#8b8b8b]">No tree data available</div>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <DetailPanel
          selectedNode={selectedGraphNode}
          selectedFile={selectedFile}
          edges={nodeEdges}
          hoveredNode={hoveredNode}
          onCloseGraph={() => setSelectedNode(null)}
          onCloseFile={() => setSelectedFile(null)}
        />
      </main>
    </div>
  );
}
