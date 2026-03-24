"use client";

import type { DepNode, DepEdge, TreeNode } from "@/lib/types";
import { X, File, Folder, ArrowRight, Hash, ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  selectedNode?: DepNode;
  selectedFile?: TreeNode | null;
  edges: DepEdge[];
  hoveredNode?: string | null;
  onCloseGraph: () => void;
  onCloseFile: () => void;
}

export function DetailPanel({
  selectedNode,
  selectedFile,
  edges,
  hoveredNode,
  onCloseGraph,
  onCloseFile,
}: DetailPanelProps) {
  const hasGraphSelection = !!selectedNode;
  const hasFileSelection = !!selectedFile;

  return (
    <aside className="w-[380px] bg-[#252525] border-l border-[#3a3a3a] flex flex-col overflow-hidden">
      {/* Graph Details */}
      {hasGraphSelection && (
        <div className="flex flex-col h-1/2 border-b border-[#3a3a3a]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3a] bg-[#1a1a1a]">
            <h2 className="text-sm font-semibold">Graph Node Details</h2>
            <button
              onClick={onCloseGraph}
              className="p-1 hover:bg-[#3a3a3a] rounded transition-colors"
            >
              <X size={16} className="text-[#8b8b8b]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Name</label>
                <p className="text-[#e0e0e0] font-medium mt-1">{selectedNode.name}</p>
              </div>

              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Path</label>
                <p className="text-[#e0e0e0] text-sm mt-1 break-all">{selectedNode.rel_path}</p>
              </div>

              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Description</label>
                <p className="text-[#e0e0e0] text-sm mt-1">
                  {selectedNode.description || "No description available"}
                </p>
              </div>

              {selectedNode.is_gitignored && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs">
                  Gitignored
                </div>
              )}

              {selectedNode.hash && (
                <div>
                  <label className="text-xs text-[#8b8b8b] uppercase tracking-wide flex items-center gap-1">
                    <Hash size={12} /> Hash
                  </label>
                  <p className="text-[#e0e0e0] text-xs mt-1 font-mono break-all">
                    {selectedNode.hash}
                  </p>
                </div>
              )}

              {edges.length > 0 && (
                <div>
                  <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">
                    Connections ({edges.length})
                  </label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {edges.map((edge, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[#5e5e5e] truncate max-w-[120px]">
                            {edge.from.split("/").pop()}
                          </span>
                          <ArrowRight size={12} className="text-[#8b8b8b] flex-shrink-0" />
                          <span className="text-[#8B5CF6] truncate max-w-[120px]">
                            {edge.to.split("/").pop()}
                          </span>
                        </div>
                        {edge.import_stmt && (
                          <p className="text-xs text-[#8b8b8b] mt-1 truncate">
                            {edge.import_stmt}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Details */}
      {hasFileSelection && (
        <div className={cn("flex flex-col", hasGraphSelection ? "h-1/2" : "h-full")}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#3a3a3a] bg-[#1a1a1a]">
            <h2 className="text-sm font-semibold">File Details</h2>
            <button
              onClick={onCloseFile}
              className="p-1 hover:bg-[#3a3a3a] rounded transition-colors"
            >
              <X size={16} className="text-[#8b8b8b]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedFile.is_file ? (
                  <File size={20} className="text-[#5e5e5e]" />
                ) : (
                  <Folder size={20} className="text-[#F59E0B]" />
                )}
                <div>
                  <p className="text-[#e0e0e0] font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-[#8b8b8b]">
                    {selectedFile.is_file ? "File" : "Directory"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Relative Path</label>
                <p className="text-[#e0e0e0] text-sm mt-1 break-all">{selectedFile.rel_path}</p>
              </div>

              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Absolute Path</label>
                <p className="text-[#e0e0e0] text-sm mt-1 break-all">{selectedFile.abs_path}</p>
              </div>

              {selectedFile.hash && (
                <div>
                  <label className="text-xs text-[#8b8b8b] uppercase tracking-wide flex items-center gap-1">
                    <Hash size={12} /> Hash
                  </label>
                  <p className="text-[#e0e0e0] text-xs mt-1 font-mono break-all">
                    {selectedFile.hash}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-[#8b8b8b] uppercase tracking-wide">Description</label>
                <p className="text-[#e0e0e0] text-sm mt-1">
                  {selectedFile.description || "No description available"}
                </p>
              </div>

              {/* Dependency Info */}
              {(selectedFile.depends_on?.length > 0 || selectedFile.depended_by?.length > 0) && (
                <div className="space-y-3">
                  {selectedFile.depends_on?.length > 0 && (
                    <div>
                      <label className="text-xs text-[#8b8b8b] uppercase tracking-wide flex items-center gap-1">
                        <ArrowDown size={12} className="text-[#3B82F6]" /> Depends On ({selectedFile.depends_on.length})
                      </label>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedFile.depends_on.map((dep, idx) => (
                          <span 
                            key={idx} 
                            className="text-xs px-2 py-1 bg-[#3B82F6]/20 text-[#3B82F6] rounded flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            {dep.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFile.depended_by?.length > 0 && (
                    <div>
                      <label className="text-xs text-[#8b8b8b] uppercase tracking-wide flex items-center gap-1">
                        <ArrowUp size={12} className="text-[#F59E0B]" /> Depended By ({selectedFile.depended_by.length})
                      </label>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedFile.depended_by.map((dep, idx) => (
                          <span 
                            key={idx} 
                            className="text-xs px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            {dep.split('/').pop()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasGraphSelection && !hasFileSelection && (
        <div className="flex-1 flex items-center justify-center text-[#8b8b8b] text-sm p-8 text-center">
          <div>
            <p className="mb-2">Select a node in the graph or tree to view details</p>
            <p className="text-xs text-[#404040]">
              Hover to highlight connections • Click to select • Drag to reposition
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
