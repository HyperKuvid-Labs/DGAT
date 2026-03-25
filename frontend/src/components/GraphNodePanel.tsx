"use client";

// right-panel inspector for a clicked graph node
// same visual language as DescriptionCardGrid — MiniMarkdown descriptions, nx3 dep pill grids

import ReactMarkdown from "react-markdown";
import type { DepNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getFileIconConfig, getIconBadgeStyle } from "@/lib/fileIcons";
import { Folder, ArrowDown, ArrowUp, GitBranch, Hash } from "lucide-react";

interface GraphNodePanelProps {
  node: DepNode | null;
}

export function GraphNodePanel({ node }: GraphNodePanelProps) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 select-none">
        <div className="w-11 h-11 rounded-2xl bg-[#141414] border border-[#1a1a1a] flex items-center justify-center">
          <GitBranch size={18} className="text-[#252525]" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[12.5px] font-medium text-[#333]">no node selected</p>
          <p className="text-[11px] text-[#252525]">click a node in the graph</p>
        </div>
      </div>
    );
  }

  const depsOn = node.depends_on ?? [];
  const depsBy = node.depended_by ?? [];
  const hasDesc = !!node.description?.trim() &&
    node.description !== "External dependency" &&
    node.description !== "Gitignored dependency" &&
    node.description !== "Source file";

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── header ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-11 border-b border-[#1e1e1e] shrink-0 bg-[#0c0c0c]">
        <div className="flex items-center gap-2.5 min-w-0">
          <NodeIconBadge node={node} size={13} />
          <span className="text-[12px] font-medium text-[#888] truncate">{node.name}</span>
          {node.rel_path && (
            <span className="text-[10px] text-[#2e2e2e] font-mono truncate hidden lg:block">{node.rel_path}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {depsOn.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "#4F8EF715", color: "#4F8EF770" }}>↓{depsOn.length}</span>
          )}
          {depsBy.length > 0 && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "#F59E0B15", color: "#F59E0B70" }}>↑{depsBy.length}</span>
          )}
        </div>
      </div>

      {/* ── body ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* description card */}
        <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-5">
          <div className="flex items-start gap-3 mb-4">
            <NodeIconBadge node={node} size={16} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-[#d4d4d4] leading-none">{node.name}</p>
              {node.rel_path && (
                <p className="text-[10px] text-[#333] font-mono mt-1 truncate">{node.rel_path}</p>
              )}
              {/* hash pill */}
              {node.hash && (
                <p className="flex items-center gap-1 text-[9.5px] text-[#2e2e2e] font-mono mt-1.5">
                  <Hash size={8} className="shrink-0" />
                  {node.hash.slice(0, 16)}
                </p>
              )}
            </div>
          </div>

          {/* type badges */}
          <div className="flex items-center gap-2 mb-4">
            {node.is_gitignored && (
              <span className="text-[9.5px] px-2 py-0.5 rounded-md font-mono"
                style={{ background: "#F59E0B15", color: "#F59E0B80", border: "1px solid #F59E0B20" }}>
                gitignored
              </span>
            )}
            {!node.is_file && (
              <span className="text-[9.5px] px-2 py-0.5 rounded-md font-mono"
                style={{ background: "#9B72CF15", color: "#9B72CF80", border: "1px solid #9B72CF20" }}>
                external
              </span>
            )}
            {node.is_file && !node.is_gitignored && (
              <span className="text-[9.5px] px-2 py-0.5 rounded-md font-mono"
                style={{ background: "#4F8EF715", color: "#4F8EF770", border: "1px solid #4F8EF720" }}>
                source
              </span>
            )}
          </div>

          {/* description — rendered as md */}
          <div className="border-t border-[#1a1a1a] pt-4">
            {hasDesc ? (
              <MiniMarkdown content={node.description} />
            ) : (
              <p className="text-[11.5px] italic text-[#2e2e2e]">
                {node.description || "no description"}
              </p>
            )}
          </div>
        </div>

        {/* dep pill grids */}
        {depsOn.length > 0 && (
          <DepSection label="depends on" color="#4F8EF7" items={depsOn} icon={<ArrowDown size={9} />} />
        )}
        {depsBy.length > 0 && (
          <DepSection label="used by" color="#F59E0B" items={depsBy} icon={<ArrowUp size={9} />} />
        )}
      </div>
    </div>
  );
}

/* ── dep section — nx3 pill grid ──────────────────────────── */

function DepSection({
  label, color, items, icon,
}: {
  label: string; color: string; items: string[]; icon: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5"
        style={{ color: `${color}99` }}>
        {icon}{label}
        <span className="ml-1 font-mono" style={{ color: `${color}55` }}>{items.length}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {items.map((dep) => (
          <div key={dep} className="rounded-lg border px-3 py-2"
            style={{ background: `${color}08`, borderColor: `${color}18` }}>
            <p className="text-[10.5px] font-mono truncate" style={{ color: `${color}99` }}>
              {dep.split("/").pop()}
            </p>
            <p className="text-[9px] text-[#2e2e2e] font-mono truncate mt-0.5">{dep}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── mini markdown — same as in DescriptionCardGrid ───────── */

function MiniMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p:      ({ children }: any) => <p className="text-[12px] text-[#777] leading-[1.75] mb-2 last:mb-0">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strong: ({ children }: any) => <strong className="font-semibold text-[#aaa]">{children}</strong>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        em:     ({ children }: any) => <em className="italic text-[#666]">{children}</em>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ul:     ({ children }: any) => <ul className="mb-2 space-y-0.5 pl-0">{children}</ul>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        li:     ({ children }: any) => (
          <li className="flex items-start gap-2 text-[11.5px] text-[#666] leading-[1.65]">
            <span className="text-[#333] mt-[5px] shrink-0 text-[7px]">▸</span>
            <span>{children}</span>
          </li>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        code:   ({ children }: any) => (
          <code className="text-[11px] font-mono bg-[#1a1a1a] text-[#ce9178] px-1 py-px rounded border border-[#222]">
            {children}
          </code>
        ),
        // flatten headings — too big for a panel card
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h1: ({ children }: any) => <p className="text-[12px] font-semibold text-[#999] mb-1.5">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h2: ({ children }: any) => <p className="text-[11.5px] font-semibold text-[#888] mb-1">{children}</p>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        h3: ({ children }: any) => <p className="text-[11px] font-semibold text-[#777] mb-1">{children}</p>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/* ── icon badge ────────────────────────────────────────────── */

function NodeIconBadge({ node, size = 14 }: { node: DepNode; size?: number }) {
  const pad = Math.round(size * 0.55);
  const box = size + pad * 2;

  if (!node.is_file) {
    return (
      <div className="flex items-center justify-center rounded-md shrink-0"
        style={{ width: box, height: box, background: "#9B72CF15", border: "1px solid #9B72CF28" }}>
        <Folder size={size} style={{ color: "#9B72CF" }} />
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
