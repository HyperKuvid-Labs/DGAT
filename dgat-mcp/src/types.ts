// typescript types for dgat api responses

export interface DgatFileContext {
  file: string;
  name: string;
  description: string;
  dependencies: Array<{
    file: string;
    import_stmt?: string;
    description?: string;
  }>;
  dependents: Array<{
    file: string;
    import_stmt?: string;
    description?: string;
  }>;
  complexity: {
    incoming_deps: number;
    outgoing_deps: number;
    transitive_dependents: number;
  };
}

export interface DgatDependency {
  file: string;
  import_stmt?: string;
  description?: string;
}

export interface DgatEdge {
  from: string;
  to: string;
  import_stmt: string;
  description: string;
}

export interface DgatSearchResult {
  file: string;
  name: string;
  description: string;
  match_type: string;
  score: number;
}

export interface DgatImpactResult {
  file: string;
  change_type: string;
  direct_dependents: Array<{
    file: string;
    distance: number;
    risk: string;
    reason?: string;
  }>;
  transitive_dependents: Array<{
    file: string;
    distance: number;
    risk: string;
    reason?: string;
  }>;
  total_affected_files: number;
  summary: string;
}

export interface DgatModuleSummary {
  directory: string;
  files: Array<{
    file: string;
    name: string;
    description: string;
    depends_on_count: number;
    depended_by_count: number;
  }>;
  internal_deps: Array<{
    from: string;
    to: string;
    description: string;
    import_stmt: string;
  }>;
  external_deps: Array<{
    from: string;
    to: string;
    description?: string;
  }>;
  depended_by_external: Array<{
    from: string;
    to: string;
    description?: string;
  }>;
  file_count: number;
  internal_dep_count: number;
  external_dep_count: number;
  depended_by_external_count: number;
  error?: string;
}

export interface DgatCircularDeps {
  cycles: string[][];
  count: number;
}

export interface DgatEntryPoint {
  file: string;
  name: string;
  depended_by_count: number;
  depends_on_count: number;
  description: string;
}

export interface DgatOrphan {
  file: string;
  name: string;
  description: string;
}

export interface DgatStats {
  total_files: number;
  total_folders: number;
  total_edges: number;
  files_with_descriptions: number;
  files_with_dependencies: number;
  avg_deps_per_file: number;
  max_deps: number;
  max_dependents: number;
  circular_dependency_count: number;
  orphan_file_count: number;
}

export interface DgatError {
  error: string;
  code: string;
}
