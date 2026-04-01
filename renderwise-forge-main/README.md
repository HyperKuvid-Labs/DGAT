# DGAT Frontend

The interactive UI for DGAT (Dependency Graph as a Tool). Three-panel layout with a file explorer, blueprint/graph tabs, and an inspector panel — all backed by a local C++ HTTP server.

## What it does

Consumes the JSON state produced by `dgat [path]` and renders it as:

- **Explorer panel** — collapsible file tree with descriptions on hover/click
- **Blueprint tab** — rendered `dgat_blueprint.md` markdown
- **Graph tab** — WebGL dependency graph via Sigma.js with node/edge inspection
- **Inspector panel** — details for the selected node or edge, including LLM-generated descriptions and dependency relationships

## Tech stack

- React 18 + TypeScript
- Vite
- Sigma.js + graphology for the dependency graph visualization
- shadcn/ui + Tailwind CSS
- react-markdown for blueprint rendering
- react-resizable-panels for the three-panel layout

## Getting started

```bash
bun install
bun dev
```

Make sure the DGAT backend is running first:

```bash
# from the parent directory
dgat /path/to/project   # scan first
dgat --backend          # then start the API server on :8090
```

The frontend proxies API requests to `http://localhost:8090` by default.

## API endpoints

| Endpoint | Source |
|---|---|
| `GET /api/tree` | `file_tree.json` |
| `GET /api/dep-graph` | `dep_graph.json` |
| `GET /api/blueprint` | `dgat_blueprint.md` |
| `GET /health` | health check |

## Examples

The `public/examples/` folder contains pre-scanned project outputs you can browse without running a scan yourself:

- `dgat-self/` — DGAT's own source tree analyzed by itself
- `hermes-agent/` — a separate project analyzed by DGAT

Each example folder contains `file-tree.json`, `dep_graph.json`, and `dgat_blueprint.md`.
