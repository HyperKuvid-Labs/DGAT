import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { TreeNode } from "@/lib/types";

interface FileNode {
  name: string;
  path: string;
  isFile: boolean;
  children: FileNode[];
}

interface RawEdge {
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  description?: string;
}

interface DepGraphFile {
  edges: RawEdge[];
}

interface FileTreeFile {
  children: TreeNode[];
}

const basename = (path: string) => path.split("/").pop() || path;

async function fetchFirst<T>(paths: string[], parser: "json" | "text"): Promise<T> {
  let lastError: unknown;
  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        lastError = new Error(`${path} (${response.status})`);
        continue;
      }
      if (parser === "json") {
        return await response.json() as T;
      }
      return await response.text() as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No matching file found");
}

function toFileNodes(nodes: TreeNode[]): FileNode[] {
  const mapped = nodes.map((node) => ({
    name: node.name,
    path: node.rel_path,
    isFile: node.is_file,
    children: toFileNodes(node.children || []),
  }));

  mapped.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return mapped;
}

function collectFileRecords(nodes: TreeNode[], out: Map<string, TreeNode>) {
  nodes.forEach((node) => {
    if (node.is_file) {
      out.set(node.rel_path, node);
      return;
    }
    collectFileRecords(node.children || [], out);
  });
}

// FileTree component
function FileTreeView({ nodes, selectedNode, onSelect, expandedDirs, onToggleDir }: {
  nodes: FileNode[];
  selectedNode: string | null;
  onSelect: (name: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  return (
    <div className="text-[13px]">
      {nodes.map(node => (
        <div key={node.path}>
          <button
            onClick={() => node.isFile ? onSelect(node.name) : onToggleDir(node.path)}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-raised cursor-pointer border-none bg-transparent ${
              selectedNode === node.name ? "bg-raised text-dgat-text" : "text-dgat-muted"
            }`}
            style={{ paddingLeft: `${(node.path.split("/").length - 1) * 12 + 12}px` }}
          >
            {!node.isFile ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`transition-transform ${expandedDirs.has(node.path) ? "rotate-90" : ""}`}>
                <path d="M6 4l4 4-4 4" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dgat-subtle">
                <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
                <polyline points="9 1 9 5 13 5" />
              </svg>
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {!node.isFile && expandedDirs.has(node.path) && node.children.length > 0 && (
            <FileTreeView
              nodes={node.children}
              selectedNode={selectedNode}
              onSelect={onSelect}
              expandedDirs={expandedDirs}
              onToggleDir={onToggleDir}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface GraphExplorerProps {
  exampleId: string;
}

export function GraphExplorer({ exampleId }: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"blueprint" | "graph">("graph");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [depEdges, setDepEdges] = useState<RawEdge[]>([]);
  const [blueprint, setBlueprint] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      setSelectedNode(null);
      setSearchQuery("");

      const exampleBase = `/examples/${exampleId}`;

      const treeCandidates = [
        `${exampleBase}/file_tree.json`,
        `${exampleBase}/tree-file.json`,
        `${exampleBase}/tree_file.json`,
      ];

      const depCandidates = [
        `${exampleBase}/dep_graph.json`,
        `${exampleBase}/dep-graph.json`,
        `${exampleBase}/depgraph.json`,
      ];

      const blueprintCandidates = [
        `${exampleBase}/dgat_blueprint.md`,
        `${exampleBase}/blueprint.md`,
      ];

      try {
        const [treeFile, depFile, blueprintText] = await Promise.all([
          fetchFirst<FileTreeFile>(treeCandidates, "json"),
          fetchFirst<DepGraphFile>(depCandidates, "json"),
          fetchFirst<string>(blueprintCandidates, "text"),
        ]);

        if (!mounted) return;

        setTreeData(treeFile.children || []);
        setDepEdges(depFile.edges || []);
        setBlueprint(blueprintText || "");

        const rootDirs = (treeFile.children || []).filter((node) => !node.is_file).map((node) => node.rel_path);
        setExpandedDirs(new Set(rootDirs));
      } catch {
        if (!mounted) return;
        setLoadError("Could not load one or more example files. Add dgat_blueprint.md, file_tree.json (or tree-file.json), and dep_graph.json (or dep-graph.json) under this example in /public/examples.");
        setTreeData([]);
        setDepEdges([]);
        setBlueprint("");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [exampleId]);

  const fileTree = useMemo(() => toFileNodes(treeData), [treeData]);

  const graph = useMemo(() => {
    const nextGraph = new Graph();
    const fileMap = new Map<string, TreeNode>();
    collectFileRecords(treeData, fileMap);

    fileMap.forEach((file, relPath) => {
      nextGraph.addNode(relPath, {
        label: basename(relPath),
        fullPath: relPath,
        x: 0,
        y: 0,
        size: 5,
        color: "#444444",
        description: file.description || `File: ${relPath}`,
      });
    });

    depEdges.forEach((edge) => {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (!from || !to) return;

      if (!nextGraph.hasNode(from)) {
        nextGraph.addNode(from, {
          label: basename(from),
          fullPath: from,
          x: 0,
          y: 0,
          size: 5,
          color: "#444444",
          description: `File: ${from}`,
        });
      }

      if (!nextGraph.hasNode(to)) {
        nextGraph.addNode(to, {
          label: basename(to),
          fullPath: to,
          x: 0,
          y: 0,
          size: 5,
          color: "#444444",
          description: `File: ${to}`,
        });
      }

      const edgeKey = `${from}->${to}`;
      if (!nextGraph.hasEdge(edgeKey)) {
        nextGraph.addEdgeWithKey(edgeKey, from, to, {
          color: "#2E2E2E",
          size: 1,
          description: edge.description || "",
        });
      }
    });

    nextGraph.forEachNode((node) => {
      const degree = nextGraph.degree(node);
      const size = degree > 10 ? 12 : degree > 5 ? 9 : degree > 2 ? 7 : 5;
      const color = degree > 8 ? "#E8E8E8" : degree > 4 ? "#888888" : "#444444";
      nextGraph.setNodeAttribute(node, "size", size);
      nextGraph.setNodeAttribute(node, "color", color);
    });

    if (nextGraph.order > 0) {
      circular.assign(nextGraph);
      forceAtlas2.assign(nextGraph, { iterations: 80, settings: { gravity: 1, scalingRatio: 5 } });
    }

    return nextGraph;
  }, [treeData, depEdges]);

  // Initialize Sigma
  useEffect(() => {
    if (!containerRef.current || activeTab !== "graph" || loading || graph.order === 0) return;

    const renderer = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      labelFont: "'JetBrains Mono', monospace",
      labelSize: 11,
      labelColor: { color: "#888888" },
      defaultEdgeColor: "#2E2E2E",
      defaultEdgeType: "line",
    });

    sigmaRef.current = renderer;

    renderer.on("clickNode", ({ node }) => {
      setSelectedNode(node);
    });

    renderer.on("clickStage", () => {
      setSelectedNode(null);
    });

    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [graph, activeTab, loading]);

  // Highlight neighbors on selection
  useEffect(() => {
    if (!sigmaRef.current) return;
    const sigma = sigmaRef.current;

    if (selectedNode) {
      const neighbors = new Set(graph.neighbors(selectedNode));
      neighbors.add(selectedNode);

      sigma.setSetting("nodeReducer", (node, data) => {
        if (neighbors.has(node)) return { ...data, color: data.color };
        return { ...data, color: "#1A1A1A", label: "" };
      });
      sigma.setSetting("edgeReducer", (edge, data) => {
        const [s, t] = graph.extremities(edge);
        if (neighbors.has(s) && neighbors.has(t)) return { ...data, color: "#555555", size: 2 };
        return { ...data, color: "#111111", size: 0.5 };
      });
    } else {
      sigma.setSetting("nodeReducer", null);
      sigma.setSetting("edgeReducer", null);
    }
    sigma.refresh();
  }, [selectedNode, graph]);

  // Search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (!sigmaRef.current || !query.trim()) {
      setSelectedNode(null);
      return;
    }
      const found = graph.nodes().find(n => {
      const label = graph.getNodeAttribute(n, "label") as string;
      const fullPath = (graph.getNodeAttribute(n, "fullPath") as string) || "";
      const q = query.toLowerCase();
      return label.toLowerCase().includes(q) || fullPath.toLowerCase().includes(q);
    });
    if (found) {
      setSelectedNode(found);
      const camera = sigmaRef.current.getCamera();
      const pos = sigmaRef.current.getNodeDisplayData(found);
      if (pos) camera.animate({ x: pos.x, y: pos.y, ratio: 0.3 }, { duration: 300 });
    }
  }, [graph]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const nodeDescription = selectedNode ? (graph.getNodeAttribute(selectedNode, "description") as string) || `File: ${selectedNode}` : null;
  const nodeDeps = selectedNode ? graph.neighbors(selectedNode) : [];

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[600px]">
      {/* File Tree Sidebar */}
      <div className="w-[240px] border-r border-dgat-border flex flex-col flex-shrink-0 bg-surface overflow-hidden">
        <div className="px-3 py-2.5 border-b border-dgat-border flex items-center gap-2">
          <span className="font-mono text-[11px] text-dgat-subtle font-medium tracking-wider uppercase">Explorer</span>
        </div>
        <div className="flex border-b border-dgat-border">
          <button
            onClick={() => setActiveTab("blueprint")}
            className={`flex-1 py-2 text-[12px] font-medium border-none cursor-pointer transition-colors ${activeTab === "blueprint" ? "bg-raised text-dgat-text" : "bg-transparent text-dgat-muted hover:bg-raised"}`}
          >
            Blueprint
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex-1 py-2 text-[12px] font-medium border-none cursor-pointer transition-colors ${activeTab === "graph" ? "bg-raised text-dgat-text" : "bg-transparent text-dgat-muted hover:bg-raised"}`}
          >
            Graph
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-[13px] text-dgat-subtle">Loading file tree...</div>
          ) : (
            <FileTreeView
              nodes={fileTree}
              selectedNode={selectedNode}
              onSelect={setSelectedNode}
              expandedDirs={expandedDirs}
              onToggleDir={toggleDir}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {activeTab === "graph" ? (
          <>
            {/* Search */}
            <div className="absolute top-3 left-3 z-10">
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="bg-surface/90 backdrop-blur border border-dgat-border rounded-md px-3 py-1.5 text-[13px] text-dgat-text font-mono placeholder:text-dgat-subtle w-[200px] focus:outline-none focus:border-dgat-border2"
              />
            </div>
            {loading ? (
              <div className="flex-1 bg-background flex items-center justify-center text-[13px] text-dgat-subtle">Loading graph...</div>
            ) : loadError ? (
              <div className="flex-1 bg-background flex items-center justify-center p-6 text-[13px] text-dgat-subtle text-center">{loadError}</div>
            ) : (
              <div ref={containerRef} className="flex-1 bg-background" />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="font-heading text-xl font-bold text-dgat-text mb-4">DGAT Software Blueprint</h2>
            {loading ? (
              <div className="text-[14px] text-dgat-subtle">Loading blueprint...</div>
            ) : loadError ? (
              <div className="text-[14px] text-dgat-subtle">{loadError}</div>
            ) : (
              <pre className="text-[14px] text-dgat-muted leading-[1.75] whitespace-pre-wrap font-sans">{blueprint}</pre>
            )}
          </div>
        )}
      </div>

      {/* Inspector Panel */}
      <div className="w-[280px] border-l border-dgat-border flex flex-col flex-shrink-0 bg-surface overflow-hidden">
        <div className="px-3 py-2.5 border-b border-dgat-border">
          <span className="font-mono text-[11px] text-dgat-subtle font-medium tracking-wider uppercase">Inspector</span>
        </div>
        {selectedNode ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">File</div>
              <div className="font-heading text-[15px] font-bold text-dgat-text">{selectedNode}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">Description</div>
              <p className="text-[13px] text-dgat-muted leading-[1.6]">{nodeDescription}</p>
            </div>
            {nodeDeps.length > 0 && (
              <div>
                <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-2">Dependencies ({nodeDeps.length})</div>
                <div className="space-y-1">
                  {nodeDeps.map(dep => (
                    <button
                      key={dep}
                      onClick={() => setSelectedNode(dep)}
                      className="w-full text-left px-2.5 py-1.5 bg-raised border border-dgat-border rounded text-[12px] font-mono text-dgat-muted hover:text-dgat-text hover:border-dgat-border2 transition-colors cursor-pointer"
                    >
                      {basename(dep)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-[13px] text-dgat-subtle text-center">Click a node in the graph to inspect its details and dependencies.</p>
          </div>
        )}
      </div>
    </div>
  );
}
