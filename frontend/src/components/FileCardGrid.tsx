"use client";

import { useState, useCallback } from "react";
import {
  X,
  Hash,
  FileCode,
  Folder,
  ArrowDown,
  ArrowUp,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getFileIconConfig, getIconBadgeStyle } from "@/lib/fileIcons";
import type { TreeNode } from "@/lib/types";

interface FileCardGridProps {
  files: TreeNode[];
  onRemove: (path: string) => void;
  onSelect: (file: TreeNode) => void;
  selectedPath?: string;
  className?: string;
}

// ── Dep bar: shows proportional weight of deps vs other files ──────────────
function DepBar({
  dependsOn,
  dependedBy,
  maxDeps,
}: {
  dependsOn: number;
  dependedBy: number;
  maxDeps: number;
}) {
  if (dependsOn === 0 && dependedBy === 0) return null;
  const total = maxDeps || 1;
  const outW = Math.max(4, (dependsOn / total) * 100);
  const inW = Math.max(4, (dependedBy / total) * 100);

  return (
    <div className="flex items-center gap-2 text-[10px] text-[#4a4a4a]">
      {dependsOn > 0 && (
        <div className="flex items-center gap-1.5 flex-1">
          <ArrowDown size={9} className="text-blue-400/60 shrink-0" />
          <div className="flex-1 h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500/50 rounded-full transition-all duration-500"
              style={{ width: `${outW}%` }}
            />
          </div>
          <span className="font-mono text-blue-400/70 w-4 text-right">{dependsOn}</span>
        </div>
      )}
      {dependedBy > 0 && (
        <div className="flex items-center gap-1.5 flex-1">
          <ArrowUp size={9} className="text-emerald-400/60 shrink-0" />
          <div className="flex-1 h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500/50 rounded-full transition-all duration-500"
              style={{ width: `${inW}%` }}
            />
          </div>
          <span className="font-mono text-emerald-400/70 w-4 text-right">{dependedBy}</span>
        </div>
      )}
    </div>
  );
}

// ── Collapsible dep list ───────────────────────────────────────────────────
function DepList({
  items,
  label,
  color,
  icon: Icon,
}: {
  items: string[];
  label: string;
  color: string;
  icon: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 w-full group"
        style={{ color }}
      >
        <Icon size={10} style={{ color }} className="shrink-0" />
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color }}>
          {label}
        </span>
        <span className="text-[10px] font-mono ml-0.5 opacity-70">({items.length})</span>
        <span className="ml-auto opacity-50 group-hover:opacity-100 transition-opacity">
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-1">
          {items.map((dep, i) => (
            <span
              key={i}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: `${color}12`,
                border: `1px solid ${color}28`,
                color: `${color}cc`,
              }}
              title={dep}
            >
              {dep.split("/").pop()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Extension badge ────────────────────────────────────────────────────────
function ExtBadge({ name }: { name: string }) {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : null;
  if (!ext) return null;
  const { color } = getFileIconConfig(name);
  return (
    <span
      className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}30`,
        color,
      }}
    >
      .{ext}
    </span>
  );
}

// ── Copy path button ───────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        // clipboard unavailable — silent fail
      }
    },
    [text]
  );

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-[#3a3a3a] transition-all text-[#3a3a3a] hover:text-[#8b8b8b]"
      title="Copy path"
    >
      {copied ? (
        <Check size={11} className="text-emerald-400" />
      ) : (
        <Copy size={11} />
      )}
    </button>
  );
}

// ── Individual file card ───────────────────────────────────────────────────
function FileCard({
  file,
  isSelected,
  maxDeps,
  onSelect,
  onRemove,
}: {
  file: TreeNode;
  isSelected: boolean;
  maxDeps: number;
  onSelect: (f: TreeNode) => void;
  onRemove: (path: string) => void;
}) {
  const { icon: FileIcon, color } = file.is_file
    ? getFileIconConfig(file.name)
    : { icon: Folder, color: "#E8A94B" };

  const badgeStyle = getIconBadgeStyle(color);
  const dependsOn = file.depends_on?.length || 0;
  const dependedBy = file.depended_by?.length || 0;
  const hasDeps = dependsOn > 0 || dependedBy > 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border cursor-pointer",
        "transition-all duration-200 bg-[#1e1e1e]",
        "hover:border-[#3a3a3a] hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5",
        isSelected
          ? "border-[#3B82F6]/50 ring-1 ring-[#3B82F6]/20 shadow-lg shadow-[#3B82F6]/10"
          : "border-[#252525]"
      )}
      onClick={() => onSelect(file)}
    >
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(file.rel_path);
        }}
        className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                   bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-[#3a3a3a]
                   transition-all text-[#4a4a4a] hover:text-[#cccccc]"
        title="Remove"
      >
        <X size={11} />
      </button>

      {/* Card header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Icon badge */}
        <div
          className="p-2.5 rounded-lg shrink-0 mt-0.5"
          style={badgeStyle}
        >
          <FileIcon size={16} style={{ color }} />
        </div>

        {/* Name + path + ext badge */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[14px] font-semibold text-[#e0e0e0] truncate">{file.name}</span>
            {file.is_file && <ExtBadge name={file.name} />}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#3a3a3a] font-mono truncate flex-1">{file.rel_path}</span>
            <CopyButton text={file.rel_path} />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-[#252525]" />

      {/* Description */}
      <div className="px-4 pt-3 pb-2 flex-1">
        <span className="text-[9px] uppercase tracking-wider text-[#3a3a3a] font-semibold block mb-1.5">
          Description
        </span>
        <ScrollArea className="max-h-[88px]">
          <p className="text-[12px] text-[#7a7a7a] leading-[1.7]">
            {file.description || "No description available"}
          </p>
        </ScrollArea>
      </div>

      {/* Dep bar */}
      {hasDeps && (
        <div className="px-4 pb-3">
          <DepBar
            dependsOn={dependsOn}
            dependedBy={dependedBy}
            maxDeps={maxDeps}
          />
        </div>
      )}

      {/* Deps + hash footer */}
      <div className="px-4 pb-4 space-y-2">
        {hasDeps && (
          <div className="space-y-1.5">
            <DepList
              items={file.depends_on || []}
              label="Depends On"
              color="#3B82F6"
              icon={ArrowDown}
            />
            <DepList
              items={file.depended_by || []}
              label="Depended By"
              color="#10B981"
              icon={ArrowUp}
            />
          </div>
        )}

        {file.hash && (
          <div className="flex items-center gap-1.5 text-[9px] text-[#2d2d2d] bg-[#151515] px-2.5 py-1.5 rounded-lg border border-[#1e1e1e] mt-2">
            <Hash size={9} className="shrink-0 text-[#2d2d2d]" />
            <span className="font-mono truncate">{file.hash.substring(0, 16)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main exported component ────────────────────────────────────────────────
export function FileCardGrid({
  files,
  onRemove,
  onSelect,
  selectedPath,
  className,
}: FileCardGridProps) {
  // Compute max total deps across current file set for proportional bars
  const maxDeps = files.reduce((max, f) => {
    const total = (f.depends_on?.length || 0) + (f.depended_by?.length || 0);
    return total > max ? total : max;
  }, 1);

  if (files.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-full",
          "border border-dashed border-[#252525] rounded-xl",
          className
        )}
      >
        <div className="text-center px-8">
          <div className="p-5 rounded-2xl bg-[#1e1e1e] border border-[#252525] inline-flex mb-4">
            <FileCode size={36} className="text-[#2d2d2d]" />
          </div>
          <p className="text-[14px] font-medium text-[#4a4a4a] mb-1">No files open</p>
          <p className="text-[12px] text-[#2d2d2d]">
            Click any file in the tree to open it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-3 p-1 pb-4">
        {files.map((file) => (
          <FileCard
            key={file.rel_path}
            file={file}
            isSelected={selectedPath === file.rel_path}
            maxDeps={maxDeps}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}
