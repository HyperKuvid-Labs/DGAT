"use client";

import type { DepNode, DepEdge, TreeNode } from "@/lib/types";
import { X, File, Folder, ArrowRight, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailPanelProps {
  selectedNode?: DepNode;
  selectedFile?: TreeNode | null;
  edges: DepEdge[];
  onCloseGraph: () => void;
  onCloseFile: () => void;
}

export function DetailPanel({
  selectedNode,
  selectedFile,
  edges,
  onCloseGraph,
  onCloseFile,
}: DetailPanelProps) {
  const hasGraphSelection = !!selectedNode;
  const hasFileSelection = !!selectedFile;

  return (
    <aside className="w-[380px] bg-[#121212] border-l border-[#2A2A2A] flex flex-col overflow-hidden">
      {/* Graph Details */}
      {hasGraphSelection && (
        <div className="flex flex-col h-1/2 border-b border-[#2A2A2A]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] bg-[#0F0F0F]">
            <h2 className="text-sm font-semibold">Graph Node Details</h2>
            <button
              onClick={onCloseGraph}
              className="p-1 hover:bg-[#2A2A2A] rounded transition-colors"
            >
              <X size={16} className="text-[#B0B0B0]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Name</label>
                <p className="text-[#E0E0E0] font-medium mt-1">{selectedNode.name}</p>
              </div>

              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Path</label>
                <p className="text-[#E0E0E0] text-sm mt-1 break-all">{selectedNode.id}</p>
              </div>

              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Description</label>
                <p className="text-[#E0E0E0] text-sm mt-1">
                  {selectedNode.description || "No description available"}
                </p>
              </div>

              {selectedNode.is_gitignored && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs">
                  Gitignored
                </div>
              )}

              {edges.length > 0 && (
                <div>
                  <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">
                    Connections ({edges.length})
                  </label>
                  <div className="mt-2 space-y-2">
                    {edges.map((edge, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#0F0F0F] border border-[#2A2A2A] rounded-lg"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-[#3B82F6] truncate max-w-[120px]">
                            {edge.from.split("/").pop()}
                          </span>
                          <ArrowRight size={12} className="text-[#B0B0B0] flex-shrink-0" />
                          <span className="text-[#3B82F6] truncate max-w-[120px]">
                            {edge.to.split("/").pop()}
                          </span>
                        </div>
                        {edge.import_stmt && (
                          <p className="text-xs text-[#B0B0B0] mt-1 truncate">
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] bg-[#0F0F0F]">
            <h2 className="text-sm font-semibold">File Details</h2>
            <button
              onClick={onCloseFile}
              className="p-1 hover:bg-[#2A2A2A] rounded transition-colors"
            >
              <X size={16} className="text-[#B0B0B0]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {selectedFile.is_file ? (
                  <File size={20} className="text-[#3B82F6]" />
                ) : (
                  <Folder size={20} className="text-[#F59E0B]" />
                )}
                <div>
                  <p className="text-[#E0E0E0] font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-[#B0B0B0]">
                    {selectedFile.is_file ? "File" : "Directory"}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Relative Path</label>
                <p className="text-[#E0E0E0] text-sm mt-1 break-all">{selectedFile.rel_path}</p>
              </div>

              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Absolute Path</label>
                <p className="text-[#E0E0E0] text-sm mt-1 break-all">{selectedFile.abs_path}</p>
              </div>

              {selectedFile.hash && (
                <div>
                  <label className="text-xs text-[#B0B0B0] uppercase tracking-wide flex items-center gap-1">
                    <Hash size={12} /> Hash
                  </label>
                  <p className="text-[#E0E0E0] text-xs mt-1 font-mono break-all">
                    {selectedFile.hash}
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs text-[#B0B0B0] uppercase tracking-wide">Description</label>
                <p className="text-[#E0E0E0] text-sm mt-1">
                  {selectedFile.description || "No description available"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasGraphSelection && !hasFileSelection && (
        <div className="flex-1 flex items-center justify-center text-[#B0B0B0] text-sm p-8 text-center">
          <div>
            <p className="mb-2">Select a node in the graph or tree to view details</p>
            <p className="text-xs text-[#404040]">
              Use mouse to rotate, zoom, and pan the 3D graph
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
