import {
  File,
  FileCode,
  FileCode2,
  FileText,
  FileJson,
  Braces,
  Terminal,
  Palette,
  Image,
  Database,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface FileIconConfig {
  icon: LucideIcon;
  color: string;
}

export function getFileIconConfig(name: string): FileIconConfig {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";

  switch (ext) {
    case "tsx":
    case "jsx":
      return { icon: FileCode2, color: "#61DAFB" };
    case "ts":
      return { icon: FileCode, color: "#3B78C4" };
    case "js":
    case "mjs":
    case "cjs":
      return { icon: FileCode, color: "#F7DF1E" };
    case "cpp":
    case "cc":
    case "cxx":
    case "c":
      return { icon: FileCode, color: "#00549D" };
    case "h":
    case "hpp":
      return { icon: FileCode, color: "#6B9DC2" };
    case "py":
      return { icon: FileCode, color: "#FFD43B" };
    case "json":
    case "jsonc":
      return { icon: FileJson, color: "#CBCB41" };
    case "md":
    case "mdx":
      return { icon: FileText, color: "#8B5CF6" };
    case "css":
    case "scss":
    case "sass":
    case "less":
      return { icon: Palette, color: "#F59E0B" };
    case "html":
    case "htm":
      return { icon: FileCode2, color: "#E44D26" };
    case "sh":
    case "bash":
    case "zsh":
      return { icon: Terminal, color: "#A8CC8C" };
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "ico":
      return { icon: Image, color: "#EC4899" };
    case "sql":
    case "db":
    case "sqlite":
      return { icon: Database, color: "#00B4D8" };
    case "toml":
    case "yaml":
    case "yml":
    case "env":
    case "ini":
    case "cfg":
    case "conf":
      return { icon: Settings, color: "#94A3B8" };
    case "lock":
    case "gitignore":
    case "gitattributes":
    case "editorconfig":
      return { icon: Settings, color: "#6B7280" };
    case "rs":
      return { icon: FileCode, color: "#CE422B" };
    case "go":
      return { icon: FileCode, color: "#00ADD8" };
    case "java":
    case "kt":
      return { icon: FileCode, color: "#ED8B00" };
    case "rb":
      return { icon: FileCode, color: "#CC342D" };
    case "php":
      return { icon: FileCode, color: "#8892BF" };
    case "swift":
      return { icon: FileCode, color: "#FA7343" };
    case "lua":
      return { icon: FileCode, color: "#000080" };
    case "r":
      return { icon: FileCode, color: "#276DC3" };
    default:
      // Check extensionless known filenames
      const lower = name.toLowerCase();
      if (lower === "makefile" || lower === "gnumakefile") return { icon: Settings, color: "#6B7280" };
      if (lower === "dockerfile") return { icon: Terminal, color: "#2496ED" };
      if (lower === "procfile" || lower === "gemfile" || lower === "pipfile") return { icon: Settings, color: "#6B7280" };
      if (lower.startsWith(".env")) return { icon: Settings, color: "#ECD53F" };
      return { icon: File, color: "#8b8b8b" };
  }
}

/** Hex color → translucent bg + border for icon badge containers */
export function getIconBadgeStyle(color: string): { background: string; border: string } {
  return {
    background: `${color}18`,
    border: `1px solid ${color}35`,
  };
}
