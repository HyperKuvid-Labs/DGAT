"use client";

import { useState } from "react";
import type { TreeNode } from "@/lib/types";
import { Folder, File, ChevronRight, ChevronDown } from "lucide-react";
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
            ? "bg-[#3B82F6]/20 text-[#3B82F6]"
            : "hover:bg-[#2A2A2A] text-[#E0E0E0]"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-[#B0B0B0]" />
          ) : (
            <ChevronRight size={14} className="text-[#B0B0B0]" />
          )
        ) : (
          <span className="w-3.5" />
        )}

        {node.is_file ? (
          <File size={14} className={isSelected ? "text-[#3B82F6]" : "text-[#B0B0B0]"} />
        ) : (
          <Folder size={14} className="text-[#F59E0B]" />
        )}

        <span className="truncate">{node.name}</span>

        {node.description && (
          <span className="ml-auto text-xs text-[#B0B0B0] truncate max-w-[200px]">
            {node.description.substring(0, 30)}...
          </span>
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
