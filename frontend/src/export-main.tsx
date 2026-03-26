/**
 * Vite entry point for the single-file HTML export build.
 * Usage: bun run build:export  →  dist-export/index.html
 *
 * The resulting HTML is a self-contained file. The C++ backend's
 * `dgat --export <out.html>` command injects the analysis data by
 * replacing the placeholder comment with:
 *   <script>window.__DGAT_DATA__ = { tree: …, graph: …, blueprint: "…" };</script>
 */
import React from "react";
import { createRoot } from "react-dom/client";
import "./app/globals.css";
import theme from "../theme.json";
import Home from "./app/page";

// Apply theme CSS variables from theme.json onto <html>
const style = document.createElement("style");
style.textContent =
  `:root{` +
  Object.entries(theme as Record<string, string>)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";") +
  `}`;
document.head.appendChild(style);

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");

createRoot(root).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>
);
