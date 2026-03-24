"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import type { DepGraph, TreeNode } from "@/lib/types";
import { FileTree } from "@/components/FileTree";
import { DetailPanel } from "@/components/DetailPanel";
import { cn } from "@/lib/utils";
import { Network, Files, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
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
  const graphRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [graphRes, treeRes] = await Promise.all([
          fetch(`${API_BASE}/api/dep-graph`),
          fetch(`${API_BASE}/api/tree`),
        ]);

        if (!graphRes.ok || !treeRes.ok) {
          throw new Error("Failed to fetch data from server");
        }

        const graphJson = await graphRes.json();
        const treeJson = await treeRes.json();

        setGraphData(graphJson);
        setTreeData(treeJson);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNodeClick = useCallback((node: any) => {
    setSelectedNode(node.id || node.name);
  }, []);

  const handleFileSelect = useCallback((file: TreeNode) => {
    setSelectedFile(file);
  }, []);

  const transformGraphData = () => {
    const nodes = graphData.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      group: n.is_gitignored ? "gitignored" : "internal",
    }));

    const links = graphData.edges.map((e) => ({
      source: e.from,
      target: e.to,
      import_stmt: e.import_stmt,
    }));

    return { nodes, links };
  };

  const nodeColor = (node: any) => {
    if (node.group === "gitignored") return "#F59E0B";
    return "#3B82F6";
  };

  const handleZoomIn = () => {
    if (graphRef.current) {
      const camera = graphRef.current.cameraPosition();
      graphRef.current.cameraPosition({
        x: camera.x,
        y: camera.y,
        z: camera.z * 0.8,
      });
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const camera = graphRef.current.cameraPosition();
      graphRef.current.cameraPosition({
        x: camera.x,
        y: camera.y,
        z: camera.z * 1.2,
      });
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  const selectedGraphNode = graphData.nodes.find((n) => n.id === selectedNode);
  const nodeEdges = graphData.edges.filter(
    (e) => e.from === selectedNode || e.to === selectedNode
  );

  if (loading && !graphData.nodes.length) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0F0F0F]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#B0B0B0]">Loading DGAT...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0F0F0F]">
        <div className="text-center p-8 bg-[#121212] border border-[#2A2A2A] rounded-xl max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <p className="text-[#B0B0B0] text-sm">
            Make sure the DGAT server is running: ./build/dgat --gui
          </p>
        </div>
      </div>
    );
  }

  const graph3DData = transformGraphData();

  return (
    <div className="flex flex-col h-screen bg-[#0F0F0F] text-[#E0E0E0]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#121212] border-b border-[#2A2A2A]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">DGAT</h1>
          <span className="text-xs text-[#B0B0B0]">Dependency Graph as a Tool</span>
        </div>

        <div className="flex items-center gap-2 bg-[#0F0F0F] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("graph")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "graph"
                ? "bg-[#3B82F6] text-white"
                : "text-[#B0B0B0] hover:text-[#E0E0E0]"
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
                ? "bg-[#3B82F6] text-white"
                : "text-[#B0B0B0] hover:text-[#E0E0E0]"
            )}
          >
            <Files size={16} />
            Tree
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#B0B0B0]">
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.edges.length} edges</span>
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
                  <ForceGraph3D
                    ref={graphRef}
                    graphData={graph3DData}
                    nodeLabel="name"
                    nodeColor={nodeColor}
                    nodeVal={10}
                    linkColor={() => "#404040"}
                    linkWidth={1}
                    backgroundColor="#0F0F0F"
                    onNodeClick={handleNodeClick}
                    cooldownTicks={100}
                  />

                  {/* Graph Controls */}
                  <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                    <button
                      onClick={handleZoomIn}
                      className="p-3 bg-[#121212] border border-[#2A2A2A] rounded-lg hover:border-[#3B82F6] transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn size={20} />
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="p-3 bg-[#121212] border border-[#2A2A2A] rounded-lg hover:border-[#3B82F6] transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut size={20} />
                    </button>
                    <button
                      onClick={handleReset}
                      className="p-3 bg-[#121212] border border-[#2A2A2A] rounded-lg hover:border-[#3B82F6] transition-colors"
                      title="Reset View"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="absolute bottom-6 left-6 bg-[#121212] border border-[#2A2A2A] rounded-lg p-4 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded bg-[#3B82F6]"></div>
                      <span className="text-[#B0B0B0]">Internal</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-[#F59E0B]"></div>
                      <span className="text-[#B0B0B0]">Gitignored</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-[#B0B0B0]">
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
                <div className="text-[#B0B0B0]">No tree data available</div>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <DetailPanel
          selectedNode={selectedGraphNode}
          selectedFile={selectedFile}
          edges={nodeEdges}
          onCloseGraph={() => setSelectedNode(null)}
          onCloseFile={() => setSelectedFile(null)}
        />
      </main>
    </div>
  );
}
