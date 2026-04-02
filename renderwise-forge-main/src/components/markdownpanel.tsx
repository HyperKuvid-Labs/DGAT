"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RefreshCw, FileText, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface MarkdownPanelProps {
  filePath: string;
  title: string;
  apiBase: string;
  /** Pre-loaded content (used in static export mode — skips the fetch). */
  staticContent?: string;
  className?: string;
}

type FetchState = "idle" | "loading" | "success" | "error";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

function sanitizeMarkdown(content: string): string {
  const fencedMdRegex = /^```markdown\s*\n([\s\S]*?)\n```$/;
  const match = content.trim().match(fencedMdRegex);
  if (match) return match[1].trim();
  return content;
}

export function extractBlueprintTitle(content: string): string {
  const sanitized = sanitizeMarkdown(content);
  const titleMatch = sanitized.match(/^(?:#\s+|##\s+)(.+)$/m);
  if (titleMatch) return titleMatch[1].trim();
  return "Blueprint";
}

export function stripBlueprintTitle(content: string): string {
  const sanitized = sanitizeMarkdown(content);
  return sanitized.replace(/^(?:#\s+|##\s+).+$/m, "").replace(/^\n+/, "").trim();
}

export function MarkdownRenderer({ content, className, compact = false }: MarkdownRendererProps) {
  const sanitized = sanitizeMarkdown(content);
  return (
    <div className={cn(compact ? "px-0 py-0" : "px-10 py-8 max-w-[680px]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code({ className, children, ...props }: any) {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <pre className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-5 py-4 overflow-x-auto my-5">
                  <code className={cn("text-[13px] font-mono leading-[1.7] text-[#ce9178]", className)} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }
            return (
              <code className="text-[13px] font-mono bg-[#1a1a1a] text-[#ce9178] px-1.5 py-0.5 rounded border border-[#222]" {...props}>
                {children}
              </code>
            );
          },

          h1({ children }) {
            return (
              <h1 className="text-[24px] font-bold text-[#e8e8e8] mt-0 mb-5 pb-3 border-b border-[#1e1e1e] leading-tight tracking-tight">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-[18px] font-semibold text-[#d0d0d0] mt-8 mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-[#9B72CF]/60 shrink-0 inline-block" />
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-[16px] font-semibold text-[#b8b8b8] mt-6 mb-2">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-[14px] font-semibold text-[#999] mt-4 mb-1.5">
                {children}
              </h4>
            );
          },

          p({ children }) {
            return (
              <p className="text-[15px] text-[#888] leading-[1.9] mb-4">
                {children}
              </p>
            );
          },

          ul({ children }) {
            return <ul className="mb-4 pl-1">{children}</ul>;
          },
          ol({ children }) {
            return (
              <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-[15px] text-[#888]">
                {children}
              </ol>
            );
          },
          li({ children }) {
            return (
              <li className="text-[15px] text-[#888] leading-[1.8] flex gap-2.5 items-start mb-1.5">
                <span className="text-[#333] mt-[2px] shrink-0 text-[8px]">▸</span>
                <div className="min-w-0 [&>p]:m-0 [&>p]:leading-[1.8] [&>p:last-child]:mb-0">{children}</div>
              </li>
            );
          },

          blockquote({ children }) {
            return (
              <blockquote className="border-l-[3px] border-[#9B72CF]/40 pl-4 py-1 my-5 bg-[#9B72CF]/[0.04] rounded-r-md">
                {children}
              </blockquote>
            );
          },

          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#4F8EF7] underline-offset-2 underline hover:text-[#7aabff] transition-colors"
              >
                {children}
              </a>
            );
          },

          table({ children }) {
            return (
              <div className="overflow-x-auto my-5 rounded-lg border border-[#1e1e1e]">
                <table className="w-full text-[13.5px] border-collapse">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-[#141414] border-b border-[#1e1e1e]">{children}</thead>;
          },
          th({ children }) {
            return <th className="text-left px-4 py-2.5 text-[12px] uppercase tracking-wider text-[#555] font-semibold">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-2.5 border-b border-[#141414] text-[#777]">{children}</td>;
          },
          tr({ children }) {
            return <tr className="hover:bg-[#111] transition-colors">{children}</tr>;
          },

          hr() {
            return <hr className="border-[#1e1e1e] my-6" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-[#c0c0c0]">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-[#777]">{children}</em>;
          },
        }}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownPanel({ filePath, title, apiBase, staticContent, className }: MarkdownPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [state, setState] = useState<FetchState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchContent = useCallback(async () => {
    setState("loading");
    try {
      const url = apiBase
        ? `${apiBase}/api/file?path=${encodeURIComponent(filePath)}`
        : `/api/blueprint`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setContent(await res.text());
      setState("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }, [apiBase, filePath]);

  useEffect(() => {
    if (staticContent !== undefined) {
      setContent(staticContent);
      setState("success");
      return;
    }
    fetchContent();
  }, [fetchContent, staticContent]);

  return (
    <div className={cn("flex flex-col h-full", className)}>

      {/* ── Panel header ─────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-[#1e1e1e] shrink-0 bg-[#0e0e0e]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-md bg-[#9B72CF]/10 border border-[#9B72CF]/20 shrink-0">
            <FileText size={12} className="text-[#9B72CF]" />
          </div>
          <span className="text-[13px] font-medium text-[#888] font-mono truncate">{title}</span>
        </div>
        <button
          onClick={fetchContent}
          disabled={state === "loading"}
          className="p-1.5 rounded-md text-[#333] hover:text-[#777] hover:bg-[#1a1a1a] transition-colors disabled:opacity-30"
        >
          <RefreshCw size={11} className={cn(state === "loading" && "animate-spin")} />
        </button>
      </div>

      {/* ── Content ──────────────────────────────────── */}
      <ScrollArea className="flex-1 bg-[#0e0e0e]">
        {(state === "idle" || state === "loading") && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="w-5 h-5 border-2 border-[#9B72CF]/30 border-t-[#9B72CF] rounded-full animate-spin" />
            <span className="text-[11px] text-[#333]">Loading…</span>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 px-6 text-center">
            <AlertCircle size={18} className="text-red-400/60" />
            <p className="text-[12px] text-[#555]">{errorMsg}</p>
            <button
              onClick={fetchContent}
              className="text-[11px] px-3 py-1.5 rounded-md bg-[#1a1a1a] hover:bg-[#222] text-[#666] border border-[#222] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {state === "success" && <MarkdownRenderer content={content ?? ""} />}
      </ScrollArea>
    </div>
  );
}
