# 02 — Build DGAT (C++ Backend)

DGAT's core is a single C++17 binary that walks directories, parses imports, queries an LLM, and serves an HTTP API.

## Option A: One-Command Install (Recommended)

The `install.sh` script handles everything — system deps, tree-sitter, grammars, and building:

```bash
# Full installation (deps + tree-sitter + grammars + build + install)
bash install.sh

# Build only (if you already installed deps)
bash install.sh build

# Build + install to /usr/local
bash install.sh install
```

### Custom Install Prefix

```bash
# Install to ~/.local instead of /usr/local (no sudo needed)
bash install.sh --prefix=$HOME/.local
```

## Option B: Manual Build with CMake

```bash
# 1. Create build directory
cmake -B build

# 2. Compile
cmake --build build -j$(nproc)

# 3. (Optional) Install system-wide
sudo cmake --build build --target install
```

### CMake Options

| Flag | Default | Description |
|---|---|---|
| `-DENABLE_TREE_SITTER=ON` | ON | Enable tree-sitter import parsing |
| `-DENABLE_GUI=ON` | ON | Enable HTTP server (cpp-httplib) |
| `-DGRAMMARS_DIR=...` | ./grammars | Path to tree-sitter grammars |
| `-DCMAKE_BUILD_TYPE=Release` | — | Build type |

```bash
# Example: Release build with custom grammars path
cmake -B build \
  -DCMAKE_BUILD_TYPE=Release \
  -DGRAMMARS_DIR=$HOME/grammars \
  -DENABLE_TREE_SITTER=ON

cmake --build build -j$(nproc)
```

## Verify the Build

```bash
# Should print DGAT usage/help
./build/dgat --help

# Or just run it with no args to see usage
./build/dgat
```

## Install Tree-Sitter Grammars (for accurate import extraction)

If you didn't use `install.sh`, install grammars manually:

```bash
# Install tree-sitter CLI
bash install.sh cli

# Install all grammars (takes a few minutes)
bash install.sh grammars

# Configure tree-sitter to find the grammars
bash install.sh configure
```

This installs grammars for: C, C++, CUDA, Python, Go, JavaScript, TypeScript, Rust, Java, Ruby, PHP, Bash, JSON, HTML, CSS, YAML, TOML, SQL, Markdown, and IPython.

## What You Get

After building, `./build/dgat` is a single binary that can:

| Command | What it does |
|---|---|
| `dgat /path/to/project` | Full scan — builds tree, descriptions, dependency graph, blueprint |
| `dgat --backend` | Start HTTP API server on port 8090 (uses saved state) |
| `dgat update` | Incremental re-scan — only re-describes changed files |
| `dgat --backend --port 9000` | Start API server on custom port |

## Output Files

After a scan, these files appear in the scanned project root:

| File | Purpose |
|---|---|
| `file_tree.json` | Complete file tree with metadata |
| `dep_graph.json` | Dependency graph (nodes + edges with LLM descriptions) |
| `dgat_blueprint.md` | AI-generated architectural overview |
| `tree-sitter-config.json` | Tree-sitter parser configuration |

> **Next:** [03 — Setup LLM (vLLM)](03-setup-llm.md)
