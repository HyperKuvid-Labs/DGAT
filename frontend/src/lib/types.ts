export interface DepNode {
  id: string;
  name: string;
  rel_path: string;
  abs_path: string;
  description: string;
  is_file: boolean;
  is_gitignored: boolean;
  hash: string;
  depends_on: string[];
  depended_by: string[];
}

export interface DepEdge {
  from: string;
  to: string;
  import_stmt: string;
  description: string;
}

export interface DepGraph {
  nodes: DepNode[];
  edges: DepEdge[];
}

/** Embedded by `dgat --export` as `window.__DGAT_DATA__`. Used in static HTML mode. */
export interface StaticData {
  tree: TreeNode;
  graph: DepGraph;
  blueprint: string;
}

export interface TreeNode {
  name: string;
  version: number;
  hash: string;
  abs_path: string;
  rel_path: string;
  is_file: boolean;
  description: string;
  error_traces: unknown[];
  children: TreeNode[];
  depends_on: string[];
  depended_by: string[];
}
