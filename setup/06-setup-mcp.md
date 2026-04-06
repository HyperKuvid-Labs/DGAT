# 06 — Setup MCP Server

The DGAT MCP (Model Context Protocol) server gives AI coding agents programmatic access to the dependency graph through a standardized interface.

## What Is MCP?

MCP is an open protocol that lets AI applications (like OpenCode, Claude Desktop, etc.) connect to local tools and data sources. The DGAT MCP server exposes 10 tools for codebase analysis.

## Available MCP Tools

| Tool | Description |
|---|---|
| `dgat_dependencies` | List all files a given file depends on |
| `dgat_dependents` | List all files that depend on a given file |
| `dgat_module_summary` | Get a summary of a module/file |
| `dgat_circular_deps` | Detect circular dependencies in the graph |
| `dgat_entry_points` | Find entry point files (no incoming dependencies) |
| `dgat_scan` | Trigger a new DGAT scan of a directory |
| `dgat_context` | Full context for a file node |
| `dgat_impact` | Blast radius analysis for a file |
| `dgat_search` | Search files by name or description |
| `dgat_blueprint` | Get the project blueprint |

## Install the MCP Server

The MCP server is in the `dgat-mcp/` directory:

```bash
cd dgat-mcp
npm install
npm run build
```

## Use Locally (Development)

```bash
cd dgat-mcp
npm run dev
```

## Use via npx (Recommended for OpenCode)

You don't need to install it globally. OpenCode will use `npx` automatically:

```jsonc
// opencode.jsonc
{
  "mcp": {
    "dgat": {
      "type": "local",
      "command": ["npx", "-y", "dgat-mcp"],
      "enabled": true
    }
  }
}
```

## Publish to npm (Optional)

If you want to share the MCP server:

```bash
cd dgat-mcp
npm publish
```

## How It Works

```
AI Agent (OpenCode / Claude / etc.)
    │
    ├── MCP Protocol (stdio)
    │
    ▼
dgat-mcp server
    │
    ├── HTTP calls to dgat --backend (localhost:8090)
    │   ├── GET /api/tree
    │   ├── GET /api/dep-graph
    │   ├── GET /api/blueprint
    │   └── POST /api/scan
    │
    └── Returns structured data to the agent
```

## Requirements

- **DGAT backend** must be running (`dgat --backend` on port 8090)
- **Node.js** 18+ (for the MCP server runtime)
- The project must have been scanned at least once (so `file_tree.json` and `dep_graph.json` exist)

## Testing the MCP Server

```bash
cd dgat-mcp

# Make sure DGAT backend is running first
# In another terminal: ./build/dgat --backend

# Start the MCP server
npm run dev
```

The MCP server communicates over stdin/stdout using the MCP protocol. You can test it with any MCP-compatible client.

> **Next:** [07 — Quick Start](07-quick-start.md)
