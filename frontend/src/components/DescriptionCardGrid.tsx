"use client";

// col 3 — inspector panel
// folder click → nx3 grid of children
// file click → big hero card (description rendered as md) + dep grid below

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import type { TreeNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getFileIconConfig, getIconBadgeStyle } from "@/lib/fileIcons";
import { Folder, FolderOpen, ArrowDown, ArrowUp, MousePointerClick } from "lucide-react";

interface DescriptionCardGridProps {
  selectedNode: TreeNode | null;
}

export function DescriptionCardGrid({ selectedNode }: DescriptionCardGridProps) {
  if (!selectedNode) return <EmptyState />;

  // file selected → hero view
  if (selectedNode.is_file) return <FileHeroView node={selectedNode} />;

  // folder selected → nx3 grid of children
  const children = selectedNode.children?.length
    ? [...selectedNode.children].sort((a, b) => {
        if (a.is_file === b.is_file) return a.name.localeCompare(b.name);
        return a.is_file ? 1 : -1; // folders first
      })
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader node={selectedNode} count={children.length} />
      <div className="flex-1 overflow-y-auto p-5">
        {children.length === 0 ? (
          <p className="text-[13px] text-[#333] italic px-1 pt-2">empty folder</p>
        ) : (
          // nx3 — each row has 3 cards, rows auto-expand
          <div className="grid grid-cols-3 gap-3">
            {children.map((child) => (
              <ChildCard key={child.rel_path || child.name} node={child} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── file hero view ─────────────────────────────────────────── */

function FileHeroView({ node }: { node: TreeNode }) {
  const depsOn = node.depends_on ?? [];
  const depsBy = node.depended_by ?? [];
  const hasDesc = !!node.description?.trim();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PanelHeader node={node} />

      <div className="flex-1 overflow-y-auto p-5 space-y-3">

        {/* description card — full width, md rendered */}
        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-6">
          <div className="flex items-center gap-3 mb-4">
            <NodeIconBadge node={node} size={16} />
            <div>
              <p className="text-[16px] font-semibold text-[#d4d4d4]">{node.name}</p>
              {node.rel_path && (
                <p className="text-[11px] text-[#333] font-mono mt-0.5">{node.rel_path}</p>
              )}
            </div>
          </div>

          {/* render description as markdown if it looks like md, else plain text */}
          <div className="border-t border-[#1a1a1a] pt-5">
            {hasDesc ? (
              <MiniMarkdown content={node.description} />
            ) : (
              <p className="text-[13px] text-[#333] italic">no description yet — run dgat to generate</p>
            )}
          </div>
        </div>

        {/* dep grid — same nx3 layout, reuses ChildCard */}
        {(depsOn.length > 0 || depsBy.length > 0) && (
          <div className="space-y-3">
            {depsOn.length > 0 && (
              <DepSection
                label="depends on"
                color="#4F8EF7"
                items={depsOn}
                icon={<ArrowDown size={10} />}
              />
            )}
            {depsBy.length > 0 && (
              <DepSection
                label="used by"
                color="#F59E0B"
                items={depsBy}
                icon={<ArrowUp size={10} />}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── dep section with nx3 pill grid ────────────────────────── */

function DepSection({
  label,
  color,
  items,
  icon,
}: {
  label: string;
  color: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-[11.5px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5"
        style={{ color: `${color}99` }}
      >
        {icon}
        {label}
        <span className="ml-1 font-mono" style={{ color: `${color}55` }}>
          {items.length}
        </span>
      </p>
      {/* nx3 grid of dep path pills */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((dep) => (
          <div
            key={dep}
            className="rounded-lg border px-3 py-2 truncate"
            style={{
              background: `${color}08`,
              borderColor: `${color}18`,
            }}
          >
            <p className="text-[12px] font-mono truncate" style={{ color: `${color}99` }}>
              {dep.split("/").pop()}
            </p>
            <p className="text-[10.5px] text-[#2e2e2e] font-mono truncate mt-0.5">{dep}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── child card (used in folder grid) ──────────────────────── */

function ChildCard({ node }: { node: TreeNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);

  const depsOn = node.depends_on?.length ?? 0;
  const depsBy = node.depended_by?.length ?? 0;
  const hasDesc = !!node.description?.trim();

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setOpen((v) => !v)}
      className={cn(
        "relative rounded-2xl border overflow-hidden cursor-pointer transition-all duration-150",
        open
          ? "col-span-3 border-[#4F8EF7]/20 bg-[#0f1520]"
          : "border-[#1e1e1e] bg-[#111111] hover:border-[#272727]"
      )}
      style={
        hovered && !open
          ? {
              background: `radial-gradient(160px circle at ${mouse.x}px ${mouse.y}px, rgba(79,142,247,0.05) 0%, #111111 65%)`,
            }
          : undefined
      }
    >
      <div className={cn("p-3.5", open && "p-5")}>
        {/* icon + name */}
        <div className="flex items-start gap-2.5 mb-2.5">
          <NodeIconBadge node={node} size={open ? 15 : 13} />
          <div className="min-w-0 flex-1">
            <p className={cn(
              "font-medium text-[#d0d0d0] truncate leading-none",
              open ? "text-[15px]" : "text-[13.5px]"
            )}>
              {node.name}
            </p>
            {node.rel_path && (
              <p className="text-[11px] text-[#2e2e2e] font-mono truncate mt-0.5">{node.rel_path}</p>
            )}
          </div>
        </div>

        {/* description — collapsed: 2-line clamp plain | expanded: full md */}
        <div className="mb-2.5">
          {hasDesc ? (
            open ? (
              <MiniMarkdown content={node.description} />
            ) : (
              <p className="text-[12.5px] text-[#555] line-clamp-2 leading-relaxed">
                {/* strip md syntax for the preview — just show raw text */}
                {node.description.replace(/[*_`#>-]/g, "").trim()}
              </p>
            )
          ) : (
            <p className="text-[12.5px] italic text-[#2e2e2e]">no description</p>
          )}
        </div>

        {/* dep badges */}
        {(depsOn > 0 || depsBy > 0) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {depsOn > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-lg font-mono"
                style={{ background: "#4F8EF715", color: "#4F8EF780", border: "1px solid #4F8EF720" }}>
                <ArrowDown size={7} />{depsOn}
              </span>
            )}
            {depsBy > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-lg font-mono"
                style={{ background: "#F59E0B15", color: "#F59E0B80", border: "1px solid #F59E0B20" }}>
                <ArrowUp size={7} />{depsBy}
              </span>
            )}
          </div>
        )}

        {/* expanded dep lists */}
        {open && (depsOn > 0 || depsBy > 0) && (
          <div className="mt-4 pt-4 border-t border-[#1a1a1a] grid grid-cols-2 gap-5">
            {node.depends_on?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#4F8EF7]/50 mb-2 font-semibold">depends on</p>
                <ul className="space-y-1">
                  {node.depends_on.map((d) => (
                    <li key={d} className="flex items-center gap-1.5 text-[12px] text-[#555] font-mono truncate">
                      <span className="w-1 h-1 rounded-full bg-[#4F8EF7]/30 shrink-0" />{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {node.depended_by?.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#F59E0B]/50 mb-2 font-semibold">used by</p>
                <ul className="space-y-1">
                  {node.depended_by.map((d) => (
                    <li key={d} className="flex items-center gap-1.5 text-[12px] text-[#555] font-mono truncate">
                      <span className="w-1 h-1 rounded-full bg-[#F59E0B]/30 shrink-0" />{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── mini markdown renderer for descriptions ───────────────── */
// keeps it tight — no big headings, just bold/bullets/code/italic

function MiniMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p({ children }: any) {
          return <p className="text-[13.5px] text-[#777] leading-[1.8] mb-2 last:mb-0">{children}</p>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strong({ children }: any) {
          return <strong className="font-semibold text-[#aaa]">{children}</strong>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        em({ children }: any) {
          return <em className="italic text-[#666]">{children}</em>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ul({ children }: any) {
          return <ul className="mb-2 space-y-0.5 pl-0">{children}</ul>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        li({ children }: any) {
          return (
            <li className="flex items-start gap-2 text-[13px] text-[#666] leading-[1.7]">
              <span className="text-[#333] mt-[5px] shrink-0 text-[7px]">▸</span>
              <span>{children}</span>
            </li>
          );
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code({ children }: any) {
          return (
            <code className="text-[12px] font-mono bg-[#1a1a1a] text-[#ce9178] px-1 py-px rounded border border-[#222]">
              {children}
            </code>
          );
        },
        // flatten headings — descriptions shouldn't have big headers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h1({ children }: any) {
          return <p className="text-[13.5px] font-semibold text-[#999] mb-1.5">{children}</p>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h2({ children }: any) {
          return <p className="text-[13px] font-semibold text-[#888] mb-1">{children}</p>;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h3({ children }: any) {
          return <p className="text-[12px] font-semibold text-[#777] mb-1">{children}</p>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ── panel header ───────────────────────────────────────────── */

function PanelHeader({ node, count }: { node: TreeNode; count?: number }) {
  const depsOn = node.depends_on?.length ?? 0;
  const depsBy = node.depended_by?.length ?? 0;

  return (
    <div className="flex items-center justify-between px-5 h-12 border-b border-[#1e1e1e] shrink-0 bg-[#0c0c0c]">
      <div className="flex items-center gap-2.5 min-w-0">
        <NodeIconBadge node={node} size={13} />
        <span className="text-[13px] font-medium text-[#888] truncate">{node.name}</span>
        {node.rel_path && (
          <span className="text-[11px] text-[#2e2e2e] font-mono truncate hidden lg:block">{node.rel_path}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* show dep counts for files */}
        {node.is_file && (depsOn > 0 || depsBy > 0) && (
          <div className="flex items-center gap-1.5">
            {depsOn > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-lg"
                style={{ background: "#4F8EF715", color: "#4F8EF770" }}>
                ↓{depsOn}
              </span>
            )}
            {depsBy > 0 && (
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-lg"
                style={{ background: "#F59E0B15", color: "#F59E0B70" }}>
                ↑{depsBy}
              </span>
            )}
          </div>
        )}
        {/* show child count for folders */}
        {!node.is_file && count !== undefined && (
          <span className="text-[11px] text-[#2a2a2a] font-mono">{count} items</span>
        )}
      </div>
    </div>
  );
}

/* ── empty state ────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
      <div className="w-11 h-11 rounded-2xl bg-[#141414] border border-[#1a1a1a] flex items-center justify-center">
        <MousePointerClick size={18} className="text-[#252525]" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-[14px] font-medium text-[#333]">nothing selected</p>
        <p className="text-[12.5px] text-[#252525]">click a file or folder in the explorer</p>
      </div>
    </div>
  );
}

/* ── icon badge ─────────────────────────────────────────────── */

function NodeIconBadge({ node, size = 14 }: { node: TreeNode; size?: number }) {
  const pad = Math.round(size * 0.55);
  const box = size + pad * 2;

  if (!node.is_file) {
    return (
      <div className="flex items-center justify-center rounded-md shrink-0"
        style={{ width: box, height: box, background: "#c8974f15", border: "1px solid #c8974f28" }}>
        <Folder size={size} style={{ color: "#c8974f" }} />
      </div>
    );
  }

  const cfg = getFileIconConfig(node.name);
  const Icon = cfg.icon;
  const badge = getIconBadgeStyle(cfg.color);

  return (
    <div className="flex items-center justify-center rounded-md shrink-0"
      style={{ width: box, height: box, ...badge }}>
      <Icon size={size} style={{ color: cfg.color }} />
    </div>
  );
}

// suppress unused import warning — FolderOpen is used in page.tsx context awareness
const _FolderOpen = FolderOpen;
void _FolderOpen;
