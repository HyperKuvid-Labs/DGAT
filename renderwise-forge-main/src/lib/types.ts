export interface ExampleConfig {
  id: string;
  name: string;
  description: string;
  github: string | null;
  website: string | null;
  langs: string[];
  stats: { nodes: number; edges: number };
  model: string | null;
  image: string | null;
}

export interface ConfigData {
  examples: ExampleConfig[];
}

export interface TreeNode {
  name: string;
  rel_path: string;
  is_file: boolean;
  children: TreeNode[];
  description?: string;
  depends_on?: string[];
  depended_by?: string[];
  hash?: string;
}

export interface DepEdge {
  source: string;
  target: string;
  description?: string;
}

export interface GraphData {
  tree: TreeNode;
  edges: DepEdge[];
}
