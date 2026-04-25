# DGAT — Dependency Graph as a Tool

Point it at any codebase. Get a fully-described, LLM-annotated dependency graph and an interactive 3D UI — no config files, no annotations, no manual work.

DGAT uses tree-sitter to extract static imports and an LLM to catch dynamic ones (importlib, conditional imports), then generates plain-English descriptions for every file, every edge, and a full architectural blueprint.

---

## Folder structure

```
DGAT/
├── dgat.cpp                  # C++ core — file tree, dep graph, LLM calls, HTTP server
├── CMakeLists.txt            # build config (auto-copies binary to src/dgat/bin/ on build)
├── queries/                  # tree-sitter .scm query files, one per language
│   ├── python.scm
│   ├── javascript.scm
│   └── ...
├── src/dgat/
│   ├── cli.py                # click CLI — scan, backend, config, update
│   ├── scanner.py            # Python wrapper around the C++ binary
│   ├── config.py             # ~/.dgat/config.json read/write
│   ├── server.py             # FastAPI backend for the 3D UI
│   ├── types.py              # Pydantic models (FileTree, DepGraph, etc.)
│   ├── ui.html               # self-contained 3D graph UI 
│   ├── providers/
│   │   ├── base.py           # BaseProvider interface
│   │   ├── openrouter.py     # OpenRouter provider
│   │   └── vllm.py           # vLLM provider (OpenAI-compatible)
│   └── bin/dgat              # compiled C++ binary (auto-populated by cmake build)
├── grammars/                 # tree-sitter grammar packages (npm)
└── model.json                # (optional) per-project provider/model override
```

---

## Prerequisites

You only need to install three things yourself before running setup:

- **Python 3.11+** and pip
- **Node.js 18+** and npm (needed for tree-sitter grammars)
- **C++17 compiler** — `clang++` on macOS (`xcode-select --install`), `g++` on Linux (`sudo apt install build-essential`)

Everything else — cmake, OpenSSL, the tree-sitter CLI, all 20 language grammars, and the C++ binary — is downloaded and built automatically by `install.sh`.

**LLM provider — pick one before scanning:**

| Provider | Requirement |
|----------|-------------|
| OpenRouter | API key from [openrouter.ai](https://openrouter.ai) |
| vLLM | vLLM server already running (`vllm serve <model>`) — setup is your own |

---

## Setup

### 1. Clone

```bash
git clone https://github.com/your-org/DGAT.git
cd DGAT
```

### 2. Run the installer

```bash
./install.sh
```

This single script handles everything:
- Installs system packages (`cmake`, `openssl`, etc.) via your OS package manager
- Downloads and installs the tree-sitter CLI
- Clones and compiles all 20 language grammar packages
- Builds the C++ binary and copies it into place

### 3. Install Python dependencies

```bash
pip install -e .
```

Installs `click`, `fastapi`, `uvicorn`, `pydantic`, `rich`, and other Python packages from PyPI.

---

## Configuration

DGAT stores config at `~/.dgat/config.json`. Use `dgat config` to manage it — you only need to set what you want to change.

**Switch to OpenRouter**
```bash
dgat config --provider openrouter --api-key sk-xxxxx
```

**Switch to vLLM**
```bash
dgat config --provider vllm
# endpoint defaults to http://localhost:8000, model to Qwen/Qwen3-2B
```

**Change just the model**
```bash
dgat config --model google/gemini-pro
```

**Change just the API key**
```bash
dgat config --api-key sk-xxxxx
```

**View current config**
```bash
dgat config
```

**Per-project override** — place a `model.json` in your project root:
```json
{
  "provider": "vllm",
  "model": "my-finetuned-model",
  "endpoint": "http://gpu-box:8000"
}
```

---

## Commands

**Scan a codebase**
```bash
dgat scan                    # scans current directory
dgat scan /path/to/project   # scans a specific path
dgat scan --deps-only        # skip LLM descriptions, just build the dep graph
```

**Open the 3D graph UI**
```bash
dgat backend                 # serves UI for current directory
dgat backend /path/to/project
```

**Incremental update** (re-scans only changed files)
```bash
dgat update
dgat update /path/to/project
```

**Typical workflow**
```bash
cd my-project
dgat scan          # builds file_tree.json, dep_graph.json, dgat_blueprint.md
dgat backend       # opens browser at http://localhost:8090
```

---

## Outputs

After `dgat scan`, three files are written to the scanned directory:

| File | Contents |
|------|----------|
| `file_tree.json` | Full file tree with LLM-generated descriptions per file |
| `dep_graph.json` | Nodes + edges with import statements, edge descriptions, and `source` tag (`static` / `inferred`) |
| `dgat_blueprint.md` | Architectural summary of the entire project |
