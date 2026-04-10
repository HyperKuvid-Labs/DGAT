# DGAT Python Package

 Comprehensive documentation for installing and using DGAT as a pip package.

## Installation

```bash
pip install dgat
```

**Requirements:**
- Python 3.11+
- A locally-hosted LLM server (vLLM, Ollama, or any OpenAI-compatible endpoint)

---

## Quick Start

### 1. Install DGAT

```bash
pip install dgat
```

### 2. Configure your LLM provider

```bash
# Interactive setup
dgat config init

# Or configure manually (vLLM example)
dgat config set providers.vllm.endpoint http://localhost:8000
dgat config set providers.vllm.model Qwen/Qwen3.5-2B
```

**Supported providers:**
- **vLLM** — Fast local inference server
- **Ollama** — Local LLM runner
- **OpenAI** — OpenAI API (cloud)
- **Anthropic** — Anthropic API (cloud)
- **OpenRouter** — Unified API gateway

### 3. Start your LLM server

```bash
# vLLM example (requires GPU)
vllm serve Qwen/Qwen3.5-2B --port 8000

# Ollama example
ollama serve
```

### 4. Run on your project

```bash
dgat scan /path/to/your/project
```

This produces:
- `file_tree.json` — Complete file tree with descriptions
- `dep_graph.json` — Dependency graph with edge annotations
- `dgat_blueprint.md` — Synthesized architectural overview

### 5. Optional: Start the UI

```bash
dgat backend
```

Then open `http://localhost:8090` in your browser — three panels: file explorer, blueprint/graph tabs, and inspector.

---

## Configuration

DGAT stores configuration in `~/.dgat/config.json` by default.

### Config file structure

```json
{
  "providers": {
    "vllm": {
      "endpoint": "http://localhost:8000",
      "model": "Qwen/Qwen3.5-2B"
    },
    "ollama": {
      "endpoint": "http://localhost:11434",
      "model": "llama3.2"
    },
    "openai": {
      "api_key": "sk-...",
      "model": "gpt-4o"
    }
  },
  "active_provider": "vllm",
  "parallel_workers": 8,
  "max_retries": 3
}
```

### CLI config commands

| Command | Description |
|---------|-------------|
| `dgat config init` | Interactive provider setup |
| `dgat config show` | Display current configuration |
| `dgat config set <key> <value>` | Set a config value |
| `dgat config test` | Test provider connectivity |

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `dgat scan [path]` | Full codebase scan — builds tree, descriptions, dep graph, blueprint |
| `dgat update [path]` | Incremental re-scan (changed files only) |
| `dgat search <query>` | Search files by name or description |
| `dgat describe <rel_path>` | Get LLM-generated description for a specific file |
| `dgat deps <rel_path>` | Show files that the given file depends on |
| `dgat dependents <rel_path>` | Show files that depend on the given file |
| `dgat blueprint` | Get the architectural blueprint (dgat_blueprint.md) |
| `dgat mcp` | Start MCP server (stdio mode) |
| `dgat mcp --http` | Start MCP server (HTTP mode) |
| `dgat backend` | Start API backend server |
| `dgat config show` | Show current configuration |
| `dgat config set <key> <value>` | Set a configuration value |
| `dgat config test` | Test if the provider API is working |

---

## Python API

Import DGAT directly into your Python code:

```python
from dgat import run_scan, run_update
from dgat import FileTree, DepGraph
from dgat.scanner import search_files
```

### Example: Running a scan

```python
from dgat import run_scan

results = run_scan(
    path="/path/to/project",
    provider="vllm",
    endpoint="http://localhost:8000",
    model="Qwen/Qwen3.5-2B"
)

print(results["blueprint"])  # Generated architectural blueprint
```

### Example: Working with the tree

```python
from dgat import FileTree

tree = FileTree.load("file_tree.json")

# Find a specific file
node = tree.find("src/utils/helpers.ts")
print(node.description)

# List all TypeScript files
ts_files = tree.find_all(extension=".ts")
for f in ts_files:
    print(f"{f.rel_path}: {f.description}")
```

### Example: Working with the graph

```python
from dgat import DepGraph

graph = DepGraph.load("dep_graph.json")

# Get dependencies for a file
node = graph.get_node("src/utils.ts")
print(f"Depends on: {node.depends_on}")
print(f"Depended by: {node.depended_by}")

# Iterate edges
for edge in graph.edges:
    print(f"{edge.from_path} -> {edge.to_path}: {edge.description}")
```

### Example: Incremental update

```python
from dgat import run_update

results = run_update(
    path="/path/to/project",
    # Uses same provider config as scan
)

print(f"Re-described {len(results['changed_files'])} files")
```

---

## MCP Server

Use DGAT as a tool in AI coding agents via the Model Context Protocol.

### Starting the MCP server

```bash
# Stdio mode (for local agents like Claude Code, Cursor, etc.)
dgat mcp

# HTTP mode (for remote agents)
dgat mcp --http
```

### Available tools

| Tool | Description |
|------|-------------|
| `scan` | Run a full codebase scan |
| `update` | Incremental re-scan |
| `describe_file` | Get description for a file |
| `get_dependencies` | Get files a file depends on |
| `get_dependents` | Get files that depend on a file |
| `get_blueprint` | Get project blueprint |
| `search_files` | Search files by name/description |
| `get_file_tree` | Get the full file tree |
| `get_dep_graph` | Get the dependency graph |

### Example: Using with Claude Code

Add to your `claude.json`:

```json
{
  "mcpServers": {
    "dgat": {
      "command": "dgat",
      "args": ["mcp"]
    }
  }
}
```

---

## Supported Languages

DGAT extracts imports from **18+ languages** using tree-sitter grammars (where available) and regex fallbacks:

| Language | Parser | Notes |
|----------|--------|-------|
| Python | tree-sitter | Full AST parsing |
| TypeScript | tree-sitter | + tsconfig path alias resolution |
| JavaScript | tree-sitter | ES modules + CommonJS |
| C | tree-sitter | + header resolution |
| C++ | tree-sitter | + template support |
| Go | tree-sitter | Single + multi-line imports |
| Rust | tree-sitter | `use` statements |
| Java | tree-sitter | Full package resolution |
| Ruby | tree-sitter | `require`/`require_relative` |
| PHP | tree-sitter | `use` namespaces |
| C# | tree-sitter | `using` statements |
| CUDA | regex | Falls back to C++ patterns |
| Bash | regex | `source` commands |
| Shell | regex | `.` and `source` |
| Makefile | regex | `include` directives |
| JSON | regex | `include` via comment |
| CSS/SCSS | regex | `@import` / `@use` |
| HTML | regex | `<script>` references |

---

## Output Files

### file_tree.json

```json
{
  "name": "myproject",
  "rel_path": ".",
  "is_file": false,
  "children": [
    {
      "name": "src",
      "rel_path": "src",
      "is_file": false,
      "children": [
        {
          "name": "utils.ts",
          "rel_path": "src/utils.ts",
          "is_file": true,
          "hash": "a1b2c3d4e5f6...",
          "description": "**Utility functions** - shared helpers for date formatting, array manipulation, and type narrowing.",
          "depends_on": [],
          "depended_by": ["src/pages/index.tsx", "src/components/Header.tsx"],
          "children": []
        }
      ]
    }
  ]
}
```

### dep_graph.json

```json
{
  "nodes": [
    {
      "id": "src/utils.ts",
      "name": "utils.ts",
      "rel_path": "src/utils.ts",
      "description": "**Utility functions** - shared helpers for date formatting...",
      "depends_on": [],
      "depended_by": ["src/pages/index.tsx", "src/components/Header.tsx"]
    }
  ],
  "edges": [
    {
      "from": "src/pages/index.tsx",
      "to": "src/utils.ts",
      "import_stmt": "import { formatDate } from '../utils'",
      "description": "index.tsx uses formatDate from utils.ts to render human-readable dates in the activity feed."
    }
  ]
}
```

### dgat_blueprint.md

A synthesized markdown document that provides an architectural overview of the entire project, generated bottom-up from individual file descriptions.

---

## .dgatignore

DGAT respects a `.dgatignore` file in the root of the scanned project. It works like `.gitignore` — one glob pattern per line:

```
node_modules/
*.lock
vendor/
dist/
build/
```

Files matched by `.dgatignore` (and `.gitignore`) are excluded from LLM processing but may still appear in the file tree without descriptions.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DGAT_CONFIG_PATH` | Path to config file | `~/.dgat/config.json` |
| `DGAT_DATA_DIR` | Path to scan output | `./.dgat` |
| `DGAT_GRAMMARS_DIR` | Path to tree-sitter grammars | Bundled |
| `DGAT_LOG_LEVEL` | Logging level | `INFO` |

---

## Troubleshooting

### "Provider connection failed"

```bash
dgat config test
```

Make sure your LLM server is running:
- vLLM: `vllm serve <model>`
- Ollama: `ollama serve`

### "No descriptions generated"

Check that:
1. The provider is configured correctly (`dgat config show`)
2. Your model has enough context window for your files
3. The model is loaded and not overloaded

### "Missing import edges"

- Make sure the file extensions are recognized
- Check that imports use standard syntax for your language
- Verify the files are in your project tree (not gitignored)

---

## License

MIT License — see [LICENSE](https://github.com/HyperKuvid-Labs/DGAT/blob/main/LICENSE) for details.

---

## Links

- **Homepage**: https://dgat.vercel.app
- **GitHub**: https://github.com/HyperKuvid-Labs/DGAT
- **PyPI**: https://pypi.org/project/dgat/
- **Issues**: https://github.com/HyperKuvid-Labs/DGAT/issues