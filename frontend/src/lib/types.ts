export interface DepNode {
  id: string;
  name: string;
  description: string;
  is_gitignored: boolean;
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
}
