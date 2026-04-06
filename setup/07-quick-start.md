# 07 — Quick Start

Get everything running in 5 minutes.

## One-Time Setup

```bash
# 1. Install system dependencies (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y \
  build-essential cmake pkg-config libssl-dev libxxhash-dev git curl gzip

# 2. Build DGAT
cmake -B build && cmake --build build -j$(nproc)

# 3. Install tree-sitter grammars (optional, improves import accuracy)
bash install.sh cli grammars configure

# 4. Install frontend dependencies
cd renderwise-forge-main && npm install && cd ..
```

## Start the LLM Server

```bash
# GPU machine
vllm serve Qwen/Qwen3.5-2B --host 0.0.0.0 --port 8000

# CPU only (slower)
vllm serve Qwen/Qwen3.5-2B --host 0.0.0.0 --port 8000 --device cpu

# Or use Ollama
ollama run qwen2.5:3b
```

## Scan a Project

```bash
# Point DGAT at any codebase
./build/dgat /path/to/your/project
```

Wait for the scan to complete. It will:
1. Walk the file tree
2. Fingerprint every file (XXH3)
3. Parse imports (tree-sitter + regex)
4. Send files to the LLM for descriptions
5. Build the dependency graph
6. Generate a blueprint

## Start the UI

```bash
# Terminal 1: DGAT backend
./build/dgat --backend

# Terminal 2: Frontend
cd renderwise-forge-main && npm run dev

# Open browser: http://localhost:5173
```

## Use with OpenCode

```bash
# In your project directory (after scanning with DGAT)

# 1. Make sure DGAT backend is running
./build/dgat --backend &

# 2. Configure OpenCode (create opencode.jsonc)
# See setup/05-setup-opencode.md for details

# 3. Start OpenCode
opencode
```

The agent will automatically connect to DGAT and understand your project architecture.

## Incremental Updates

After the initial scan, only re-scan changed files:

```bash
./build/dgat update
```

## Full Command Reference

| Command | Description |
|---|---|
| `./build/dgat /path` | Full scan of a project |
| `./build/dgat --backend` | Start API server (port 8090) |
| `./build/dgat --backend --port 9000` | Start API server (custom port) |
| `./build/dgat update` | Incremental re-scan |
| `cd renderwise-forge-main && npm run dev` | Start UI dev server |
| `opencode` | Start AI coding agent with DGAT |

## Architecture at a Glance

```
vLLM (port 8000)          DGAT Backend (port 8090)          Frontend (port 5173)
     │                          │                                  │
     ├── describes files ◄──────┤                                  │
     ├── describes edges ◄──────┤                                  │
     │                          ├── serves API ◄───────────────────┤
     │                          │                                  │
     │                          └── MCP Server ◄───────────────────┤ OpenCode
```

> **Next:** [08 — Troubleshooting](08-troubleshooting.md)
