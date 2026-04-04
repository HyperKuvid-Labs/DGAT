import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { MarkdownRenderer, extractBlueprintTitle, stripBlueprintTitle } from "@/components/markdownpanel";
import type { TreeNode, ExampleConfig } from "@/lib/types";

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
const normalizePublicPath = (path: string) => (path.startsWith("/") ? path : `/${path}`);
const joinPath = (base: string, file: string) => `${base.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;

function toCandidatePaths(path: string | undefined, bases: string[]) {
  if (!path) return [];
  if (path.startsWith("/")) return [normalizePublicPath(path)];
  return bases.map((base) => joinPath(base, path));
}

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

function filterNodesWithDependencies(nodes: FileNode[], deps: Set<string>): FileNode[] {
  return nodes.reduce<FileNode[]>((acc, node) => {
    if (node.isFile) {
      if (deps.has(node.path)) {
        acc.push(node);
      }
    } else {
      const filteredChildren = filterNodesWithDependencies(node.children, deps);
      if (filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
    }
    return acc;
  }, []);
}

// FileTree component
function FileTreeView({ nodes, selectedNode, onSelect, expandedDirs, onToggleDir }: {
  nodes: FileNode[];
  selectedNode: string | null;
  onSelect: (path: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  return (
    <div className="text-[13px]">
      {nodes.map(node => (
        <div key={node.path}>
          <button
            onClick={() => node.isFile ? onSelect(node.path) : onToggleDir(node.path)}
            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-raised cursor-pointer border-none bg-transparent ${
              selectedNode === node.path ? "bg-raised text-dgat-text" : "text-dgat-muted"
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
  files?: ExampleConfig["files"];
}

export function GraphExplorer({ exampleId, files }: GraphExplorerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [previousNode, setPreviousNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"blueprint" | "graph">("blueprint");
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [depEdges, setDepEdges] = useState<RawEdge[]>([]);
  const [blueprint, setBlueprint] = useState("");
  const [selectedRelationDescription, setSelectedRelationDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      setSelectedNode(null);
      setSelectedRelationDescription(null);
      setSearchQuery("");

      const exampleBases = [
        ...(files?.basePath ? [normalizePublicPath(files.basePath)] : []),
        `/examples/${exampleId}`,
        `/${exampleId}`,
      ];

      const treeCandidates = [
        ...toCandidatePaths(files?.tree, exampleBases),
        ...exampleBases.map((base) => `${base}/file_tree.json`),
        ...exampleBases.map((base) => `${base}/tree-file.json`),
        ...exampleBases.map((base) => `${base}/tree_file.json`),
      ];

      const depCandidates = [
        ...toCandidatePaths(files?.depGraph, exampleBases),
        ...exampleBases.map((base) => `${base}/dep_graph.json`),
        ...exampleBases.map((base) => `${base}/dep-graph.json`),
        ...exampleBases.map((base) => `${base}/depgraph.json`),
      ];

      const blueprintCandidates = [
        ...toCandidatePaths(files?.blueprint, exampleBases),
        ...exampleBases.map((base) => `${base}/dgat_blueprint.md`),
        ...exampleBases.map((base) => `${base}/blueprint.md`),
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
        setLoadError("Could not load one or more example files. Add dgat_blueprint.md, tree-file.json (or file_tree.json), and dep-graph.json (or dep_graph.json) under /public/examples/<example-id> (or /public/<example-id>), or set explicit paths in config.json.");
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
  }, [exampleId, files]);

  const nodesWithDependencies = useMemo(() => {
    const deps = new Set<string>();
    depEdges.forEach((edge) => {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (from) deps.add(from);
      if (to) deps.add(to);
    });
    return deps;
  }, [depEdges]);

  const fileRecords = useMemo(() => {
    const map = new Map<string, TreeNode>();
    collectFileRecords(treeData, map);
    return map;
  }, [treeData]);

  const fileTree = useMemo(() => {
    return toFileNodes(treeData);
  }, [treeData]);

  const graph = useMemo(() => {
    const nextGraph = new Graph();

    depEdges.forEach((edge) => {
      const from = edge.from || edge.source;
      const to = edge.to || edge.target;
      if (!from || !to) return;

      if (!nextGraph.hasNode(from)) {
        const fromRecord = fileRecords.get(from);
        nextGraph.addNode(from, {
          label: basename(from),
          fullPath: from,
          x: 0,
          y: 0,
          size: 5,
          color: "#444444",
          description: fromRecord?.description || `File: ${from}`,
        });
      }

      if (!nextGraph.hasNode(to)) {
        const toRecord = fileRecords.get(to);
        nextGraph.addNode(to, {
          label: basename(to),
          fullPath: to,
          x: 0,
          y: 0,
          size: 5,
          color: "#444444",
          description: toRecord?.description || `File: ${to}`,
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
  }, [fileRecords, depEdges]);

  const getRelationDescription = useCallback((fromNode: string, toNode: string): string | null => {
    if (!graph.hasNode(fromNode) || !graph.hasNode(toNode)) return null;

    if (graph.hasEdge(fromNode, toNode)) {
      const edgeKey = graph.edge(fromNode, toNode);
      if (!edgeKey) return null;
      return (graph.getEdgeAttribute(edgeKey, "description") as string) || null;
    }

    if (graph.hasEdge(toNode, fromNode)) {
      const edgeKey = graph.edge(toNode, fromNode);
      if (!edgeKey) return null;
      return (graph.getEdgeAttribute(edgeKey, "description") as string) || null;
    }

    return null;
  }, [graph]);

  const handleSelectNode = useCallback((nextNode: string | null) => {
    if (!nextNode || !selectedNode) {
      setSelectedRelationDescription(null);
      setPreviousNode(selectedNode);
      setSelectedNode(nextNode);
      return;
    }

    if (graph.hasNode(selectedNode) && graph.hasNode(nextNode)) {
      const relation = getRelationDescription(selectedNode, nextNode);
      setSelectedRelationDescription(relation);
    } else {
      setSelectedRelationDescription(null);
    }
    setPreviousNode(selectedNode);
    setSelectedNode(nextNode);
  }, [getRelationDescription, selectedNode, graph]);

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
      handleSelectNode(node);
    });

    renderer.on("clickStage", () => {
      handleSelectNode(null);
    });

    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [graph, activeTab, loading, handleSelectNode]);

  // Highlight neighbors on selection
  useEffect(() => {
    if (!sigmaRef.current) return;
    const sigma = sigmaRef.current;

    if (selectedNode && graph.hasNode(selectedNode)) {
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
      handleSelectNode(null);
      return;
    }
      const found = graph.nodes().find(n => {
      const label = graph.getNodeAttribute(n, "label") as string;
      const fullPath = (graph.getNodeAttribute(n, "fullPath") as string) || "";
      const q = query.toLowerCase();
      return label.toLowerCase().includes(q) || fullPath.toLowerCase().includes(q);
    });
    if (found) {
      handleSelectNode(found);
      const camera = sigmaRef.current.getCamera();
      const pos = sigmaRef.current.getNodeDisplayData(found);
      if (pos) camera.animate({ x: pos.x, y: pos.y, ratio: 0.3 }, { duration: 300 });
    }
  }, [graph, handleSelectNode]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const getNodeDescription = (node: string): string => {
    return fileRecords.get(node)?.description || (graph.hasNode(node) ? (graph.getNodeAttribute(node, "description") as string) : null) || `File: ${node}`;
  };

  const nodeDescription = selectedNode ? getNodeDescription(selectedNode) : null;
  const nodeInGraph = selectedNode ? graph.hasNode(selectedNode) : false;
  const previousInGraph = previousNode ? graph.hasNode(previousNode) : false;
  const showRelationship = previousInGraph && nodeInGraph && selectedRelationDescription;
  const previousNodeDescription = previousInGraph && showRelationship ? getNodeDescription(previousNode) : null;
  const nodeDeps = nodeInGraph ? graph.neighbors(selectedNode) : [];

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
            title="Visual dependency graph showing how files import and relate to each other"
          >
            DepGraph
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-[13px] text-dgat-subtle">Loading file tree...</div>
          ) : (
            <FileTreeView
              nodes={fileTree}
              selectedNode={selectedNode}
              onSelect={handleSelectNode}
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
            ) : graph.order === 0 ? (
              <div className="flex-1 bg-background flex items-center justify-center p-6 text-[13px] text-dgat-subtle text-center">No dependency relationships found in dep_graph.json for this example.</div>
            ) : (
              <div ref={containerRef} className="flex-1 bg-background" />
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="font-heading text-xl font-bold text-dgat-text mb-4">{blueprint ? extractBlueprintTitle(blueprint) : "Blueprint"}</h2>
            {loading ? (
              <div className="text-[14px] text-dgat-subtle">Loading blueprint...</div>
            ) : loadError ? (
              <div className="text-[14px] text-dgat-subtle">{loadError}</div>
            ) : (
              <MarkdownRenderer content={stripBlueprintTitle(blueprint)} compact className="max-w-none" />
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
            {previousNodeDescription && (
              <>
                <div>
                  <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">Source File</div>
                  <div className="font-heading text-[15px] font-bold text-dgat-text">{previousNode}</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">Description</div>
                  <MarkdownRenderer content={previousNodeDescription} compact />
                </div>
              </>
            )}
            <div>
              <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">{previousNodeDescription ? "Target File" : "File"}</div>
              <div className="font-heading text-[15px] font-bold text-dgat-text">{selectedNode}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">Description</div>
              {nodeDescription && <MarkdownRenderer content={nodeDescription} compact />}
            </div>
            {nodeInGraph && nodeDeps.length > 0 && (
              <div>
                <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-2">Dependencies ({nodeDeps.length})</div>
                <div className="space-y-1">
                  {nodeDeps.map(dep => (
                    <button
                      key={dep}
                      onClick={() => handleSelectNode(dep)}
                      className="w-full text-left px-2.5 py-1.5 bg-raised border border-dgat-border rounded text-[12px] font-mono text-dgat-muted hover:text-dgat-text hover:border-dgat-border2 transition-colors cursor-pointer"
                    >
                      {basename(dep)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showRelationship && (
              <div>
                <div className="font-mono text-[10px] text-dgat-subtle uppercase tracking-wider mb-1">Relationship</div>
                <MarkdownRenderer content={selectedRelationDescription} compact />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-[13px] text-dgat-subtle text-center">Click a node in the file tree or graph to inspect.</p>
          </div>
        )}
      </div>
    </div>
  );
}
