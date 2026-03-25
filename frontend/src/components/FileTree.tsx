"use client";

import { useState } from "react";
import type { TreeNode } from "@/lib/types";
import { FolderOpen, Folder, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileIconConfig } from "@/lib/fileIcons";

interface FileTreeProps {
  data: TreeNode;
  onSelect: (node: TreeNode) => void;
  selectedPath?: string;
}

export function FileTree({ data, onSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="py-1">
      <TreeNodeItem
        node={data}
        onSelect={onSelect}
        selectedPath={selectedPath}
        depth={0}
      />
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  onSelect: (node: TreeNode) => void;
  selectedPath?: string;
  depth: number;
}

function TreeNodeItem({ node, onSelect, selectedPath, depth }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isSelected = selectedPath === node.rel_path;
  const hasChildren = node.children && node.children.length > 0;
  const isFile = node.is_file;

  const sortedChildren = hasChildren
    ? [...node.children].sort((a, b) => {
        if (a.is_file === b.is_file) return a.name.localeCompare(b.name);
        return a.is_file ? 1 : -1;
      })
    : [];

  const handleClick = () => {
    if (hasChildren) setExpanded((e) => !e);
    onSelect(node);
  };

  const iconCfg = isFile ? getFileIconConfig(node.name) : null;
  const IconComponent = iconCfg?.icon;

  // Indent: 12px per level, starting at 8px
  const paddingLeft = depth * 12 + 8;

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft }}
        className={cn(
          "group relative flex items-center gap-1.5 h-[26px] pr-3 cursor-pointer select-none",
          "text-[13px] transition-colors duration-75",
          isSelected
            ? "bg-[#1e3a5f] text-[#e2e2e2]"
            : "text-[#9d9d9d] hover:bg-[#181818] hover:text-[#c8c8c8]"
        )}
        title={node.rel_path}
      >
        {/* Indent guide */}
        {depth > 0 && (
          <span
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#1e1e1e]"
            style={{ left: (depth - 1) * 12 + 20 }}
          />
        )}

        {/* Chevron */}
        <span className="w-3.5 flex items-center justify-center shrink-0">
          {hasChildren ? (
            <ChevronRight
              size={11}
              className={cn(
                "transition-transform duration-150",
                isSelected ? "text-[#5a8fd0]" : "text-[#444]",
                expanded && "rotate-90"
              )}
            />
          ) : null}
        </span>

        {/* Icon */}
        <span className="shrink-0 flex items-center">
          {isFile && IconComponent ? (
            <IconComponent size={14} style={{ color: isSelected ? iconCfg.color : `${iconCfg.color}cc` }} />
          ) : expanded ? (
            <FolderOpen size={14} className={isSelected ? "text-[#dcb67a]" : "text-[#c8974f]"} />
          ) : (
            <Folder size={14} className={isSelected ? "text-[#dcb67a]" : "text-[#c8974f]"} />
          )}
        </span>

        {/* Label */}
        <span className={cn(
          "flex-1 truncate leading-none",
          !isFile && "font-medium",
          isSelected ? "text-[#e2e2e2]" : ""
        )}>
          {node.name}
        </span>

        {/* Dep counts — hover/selected only */}
        {(node.depends_on?.length > 0 || node.depended_by?.length > 0) && (
          <span className={cn(
            "flex items-center gap-1 shrink-0 transition-opacity",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {node.depends_on?.length > 0 && (
              <span className="text-[9px] px-1 py-px rounded-sm bg-[#4F8EF7]/10 text-[#4F8EF7]/80 font-mono">
                ↓{node.depends_on.length}
              </span>
            )}
            {node.depended_by?.length > 0 && (
              <span className="text-[9px] px-1 py-px rounded-sm bg-[#F59E0B]/10 text-[#F59E0B]/80 font-mono">
                ↑{node.depended_by.length}
              </span>
            )}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {sortedChildren.map((child, idx) => (
            <TreeNodeItem
              key={child.rel_path || `${depth}-${idx}`}
              node={child}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
