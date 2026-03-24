"use client";

import { useState } from "react";
import type { TreeNode } from "@/lib/types";
import { Folder, File, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  data: TreeNode;
  onSelect: (file: TreeNode) => void;
  selectedPath?: string;
}

export function FileTree({ data, onSelect, selectedPath }: FileTreeProps) {
  return (
    <div className="font-mono text-sm">
      <TreeNodeItem
        node={data}
        onSelect={onSelect}
        selectedPath={selectedPath}
        level={0}
      />
    </div>
  );
}

interface TreeNodeItemProps {
  node: TreeNode;
  onSelect: (file: TreeNode) => void;
  selectedPath?: string;
  level: number;
}

function TreeNodeItem({ node, onSelect, selectedPath, level }: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const isSelected = selectedPath === node.rel_path;
  const hasChildren = node.children && node.children.length > 0;

  const dependsOnCount = node.depends_on?.length || 0;
  const dependedByCount = node.depended_by?.length || 0;
  const hasDeps = dependsOnCount > 0 || dependedByCount > 0;

  const handleClick = () => {
    if (hasChildren) {
      setExpanded(!expanded);
    }
    if (node.is_file) {
      onSelect(node);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors",
          isSelected
            ? "bg-[#5e5e5e]/30 text-[#e0e0e0]"
            : "hover:bg-[#3a3a3a] text-[#e0e0e0]"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-[#8b8b8b]" />
          ) : (
            <ChevronRight size={14} className="text-[#8b8b8b]" />
          )
        ) : (
          <span className="w-3.5" />
        )}

        {node.is_file ? (
          <File size={14} className={isSelected ? "text-[#5e5e5e]" : "text-[#8b8b8b]"} />
        ) : (
          <Folder size={14} className="text-[#F59E0B]" />
        )}

        <span className="truncate">{node.name}</span>

        {hasDeps && (
          <div className="flex items-center gap-1 ml-auto">
            {dependsOnCount > 0 && (
              <span 
                className="flex items-center gap-0.5 text-xs text-[#3B82F6]" 
                title={`${dependsOnCount} dependencies`}
              >
                <ArrowDown size={10} />
                {dependsOnCount}
              </span>
            )}
            {dependedByCount > 0 && (
              <span 
                className="flex items-center gap-0.5 text-xs text-[#F59E0B]" 
                title={`${dependedByCount} files depend on this`}
              >
                <ArrowUp size={10} />
                {dependedByCount}
              </span>
            )}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNodeItem
              key={child.rel_path || idx}
              node={child}
              onSelect={onSelect}
              selectedPath={selectedPath}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
