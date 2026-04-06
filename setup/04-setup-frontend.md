# 04 — Setup Frontend (UI)

The DGAT frontend is a React + Vite + TypeScript application with a three-panel layout: file explorer, blueprint/graph tabs, and an inspector panel.

## Location

The frontend lives in `renderwise-forge-main/`.

## Install Dependencies

```bash
cd renderwise-forge-main
npm install
```

Or with bun (faster):

```bash
cd renderwise-forge-main
bun install
```

## Run the Dev Server

```bash
cd renderwise-forge-main
npm run dev
```

The UI will be available at `http://localhost:5173`.

## Build for Production

```bash
cd renderwise-forge-main
npm run build
```

Output goes to `renderwise-forge-main/dist/`.

## Preview Production Build

```bash
cd renderwise-forge-main
npm run preview
```

## How the Frontend Connects to DGAT

The frontend talks to the DGAT backend API (started with `dgat --backend` on port 8090). Make sure the backend is running before opening the UI.

### Required Backend Endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/tree` | File tree JSON |
| `GET /api/dep-graph` | Dependency graph (nodes + edges) |
| `GET /api/blueprint` | Blueprint markdown |

## Workflow

1. **Scan your project**: `./build/dgat /path/to/project`
2. **Start the backend**: `./build/dgat --backend` (port 8090)
3. **Start the frontend**: `cd renderwise-forge-main && npm run dev`
4. **Open browser**: `http://localhost:5173`

The UI auto-refreshes every 30 seconds.

> **Next:** [05 — Setup OpenCode Integration](05-setup-opencode.md)
