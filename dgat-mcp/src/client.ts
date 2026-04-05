// http client for dgat backend — thin wrapper around fetch
// all methods map 1:1 to dgat rest api endpoints

import type {
  DgatFileContext,
  DgatDependency,
  DgatEdge,
  DgatSearchResult,
  DgatImpactResult,
  DgatModuleSummary,
  DgatCircularDeps,
  DgatEntryPoint,
  DgatOrphan,
  DgatStats,
  DgatError,
} from "./types.js";

const DEFAULT_BASE = "http://localhost:8090";

export class DgatClient {
  baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.DGAT_BACKEND_URL || DEFAULT_BASE;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const body = await res.text();
      let err: DgatError;
      try {
        err = JSON.parse(body);
      } catch {
        err = { error: body || `http ${res.status}`, code: "HTTP_ERROR" };
      }
      throw new Error(`dgat ${err.code}: ${err.error}`);
    }
    return res.json() as Promise<T>;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async getBlueprint(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/blueprint`);
    if (!res.ok) return "blueprint not available";
    return res.text();
  }

  async getContext(file: string): Promise<DgatFileContext> {
    return this.get<DgatFileContext>(`/api/context?file=${encodeURIComponent(file)}`);
  }

  async getDependencies(file: string): Promise<DgatDependency[]> {
    return this.get<DgatDependency[]>(`/api/dependencies?file=${encodeURIComponent(file)}`);
  }

  async getDependents(file: string): Promise<DgatDependency[]> {
    return this.get<DgatDependency[]>(`/api/dependents?file=${encodeURIComponent(file)}`);
  }

  async getEdge(from: string, to: string): Promise<DgatEdge> {
    return this.get<DgatEdge>(`/api/edge?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  }

  async search(query: string, scope: "name" | "description" | "both" = "both"): Promise<DgatSearchResult[]> {
    return this.get<DgatSearchResult[]>(`/api/search?q=${encodeURIComponent(query)}&scope=${scope}`);
  }

  async getImpact(file: string, changeType: "modify" | "delete" | "rename" = "modify"): Promise<DgatImpactResult> {
    return this.get<DgatImpactResult>(`/api/impact?file=${encodeURIComponent(file)}&change_type=${changeType}`);
  }

  async getModuleSummary(dir: string): Promise<DgatModuleSummary> {
    return this.get<DgatModuleSummary>(`/api/module-summary?dir=${encodeURIComponent(dir)}`);
  }

  async getCircularDeps(): Promise<DgatCircularDeps> {
    return this.get<DgatCircularDeps>("/api/circular-deps");
  }

  async getEntryPoints(): Promise<DgatEntryPoint[]> {
    return this.get<DgatEntryPoint[]>("/api/entry-points");
  }

  async getOrphans(): Promise<DgatOrphan[]> {
    return this.get<DgatOrphan[]>("/api/orphans");
  }

  async getStats(): Promise<DgatStats> {
    return this.get<DgatStats>("/api/stats");
  }
}
