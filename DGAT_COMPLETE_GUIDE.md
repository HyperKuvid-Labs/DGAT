# DGAT: Complete Working Guide

## What is DGAT?

**DGAT** (Dependency Graph as a Tool) is an LLM-powered code analysis engine that automatically scans any codebase, extracts import relationships, generates natural-language descriptions for every file and dependency, and serves it all through an interactive UI.

Key features:
- **No configuration needed** — point it at a directory, it figures out the rest
- **Multi-language support** — Python, TypeScript, JavaScript, C/C++, Go, Java, Rust, C#, Ruby, PHP, CUDA, Bash, and more
- **LLM-annotated dependency graph** — every file and every import relationship gets a natural-language description
- **Interactive UI** — three-panel explorer with file tree, blueprint/graph tabs, and inspector
- **Incremental updates** — re-scan only changed files using XXH3 fingerprinting
- **MCP integration** — use DGAT as a tool in AI coding agents

---

## Architecture Overview

DGAT consists of three main components:

```
┌─────────────────────────────────────────────────────┐
│ Python CLI Layer (Click wrapper)                    │
│ - dgat/cli.py: Command-line interface               │
│ - dgat/scanner.py: Wraps C++ binary + manages LLM   │
│ - dgat/config.py: Configuration management          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ C++ Engine (dgat.cpp - 3000+ lines)                 │
│ - Filesystem walking                                │
│ - Import extraction (tree-sitter + regex)           │
│ - Dependency graph construction                     │
│ - LLM orchestration (parallel requests)             │
│ - HTTP server & UI backend                          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Frontend (renderwise-forge-main)                    │
│ - React + TypeScript                                │
│ - Three-panel UI with Sigma.js graph visualization  │
└─────────────────────────────────────────────────────┘
```

---

## The Complete Pipeline

### Step 1: Directory Tree Walking

When you run `dgat scan /path`, the first thing DGAT does is walk the filesystem and build a **TreeNode** hierarchy.

**What it does:**
```
build_tree()
  ├─ Recursively traverse directories
  ├─ Skip .git, build artifacts, .gitignore'd files, .dgatignore'd files
  ├─ Create TreeNode for every file and directory
  ├─ Compute XXH3-128 fingerprint for each file
  └─ Store: name, rel_path, abs_path, is_file flag, hash
```

**Data structure (C++):**
```cpp
struct TreeNode {
    string name;                      // "dgat.cpp"
    int version;                      // id for DOT export
    digest_t hash;                    // XXH3-128 fingerprint
    string abs_path;                  // "/home/user/project/dgat.cpp"
    string rel_path;                  // "dgat.cpp" ← key identifier
    vector<unique_ptr<TreeNode>> children;
    bool is_file;                     // true
    vector<json> error_traces;        // error tracking
    string description;               // LLM-generated description (added later)
    vector<string> depends_on;        // files this imports
    vector<string> depended_by;       // files that import this
};
```

**Output:** `file_tree.json` — nested JSON representation of the entire project structure

---

### Step 2: Import Extraction

DGAT parses every source file to extract import relationships. It uses a two-tier approach:

#### Tier 1: Tree-sitter (Precision)

For languages with available tree-sitter grammars:
1. Detect language from file extension
2. Load corresponding query file from `queries/` directory (e.g., `queries/python.scm`)
3. Run tree-sitter query to parse the AST
4. Extract import statements and resolve paths

**Examples:**
- Python: `from module.utils import foo` → `module.utils`
- TypeScript: `import { Component } from './components'` → `./components`
- C++: `#include "helpers.h"` → `helpers.h`

#### Tier 2: Regex Fallback (Coverage)

When tree-sitter isn't available, language-specific regex patterns extract imports:

**Python:**
```python
from os import path          → "os"
from .utils import foo       → ".utils"
import numpy as np           → "numpy"
```

**C/C++:**
```cpp
#include "local.h"           → "local.h" (quoted only)
#include <vector>            → skipped (system)
```

**JavaScript/TypeScript:**
```javascript
import { foo } from './bar'  → "./bar"
const x = require('lodash')  → "lodash"
```

**Other languages:** Go, Java, Rust, Ruby, PHP, Bash, Makefile...

---

### Step 3: Import Path Normalization

Raw import statements like `@/components/Foo` or `../utils` need to be resolved to actual file paths.

#### 3a: TypeScript Path Aliases

DGAT reads `tsconfig.json` or `jsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/components/*": ["./src/components/*"],
      "@utils/*": ["./src/utils/*"]
    }
  }
}
```

Then it resolves:
- `@/components/Button` → `src/components/Button.tsx`
- `@utils/helpers` → `src/utils/helpers.ts`

#### 3b: Python Relative Imports

```python
from . import foo            → current package dir
from .. import bar           → parent package dir
from ..utils import baz      → parent_dir/utils.py
```

The resolver:
1. Counts leading dots
2. Navigates up N levels from the source file
3. Converts remaining dots to slashes

#### 3c: Relative Path Resolution

```
./utils        → relative to source file's directory
../models      → relative to parent directory
utils          → adjacent to source file
```

#### 3d: Extension Trial

When `import utils` appears, DGAT tries extensions in order:
```
"", ".py", ".tsx", ".ts", ".jsx", ".js", ".css", ".scss", ".h", ".hpp"
```

So `utils` could resolve to `utils.ts`, `utils.py`, `utils.tsx`, etc.

#### 3e: Barrel Files & Package Init

```
import { Foo } from './components'
  → tries './components.tsx', './components.ts', './components/index.tsx', './components/index.ts'
```

For Python:
```
from .components import Foo
  → './components/__init__.py'
```

#### 3f: Last Resort — Filename Match

If nothing else works, DGAT searches all known files by basename. Catches C++ header scenarios.

---

### Step 4: Build Dependency Graph

After all imports are resolved, DGAT constructs the **DepGraph** — a directed graph where:
- **Nodes** represent files
- **Edges** represent import relationships

**Data structures:**

```cpp
struct DepNode {
    string name;                // "utils.ts"
    string rel_path;            // "src/utils.ts" ← key
    string abs_path;            // "/home/user/project/src/utils.ts"
    string description;         // LLM description (added later)
    bool is_file;               // always true
    bool is_gitignored;         // excluded by .gitignore?
    string hash;                // XXH3-128 fingerprint
    vector<string> depends_on;  // files this imports
    vector<string> depended_by; // files that import this
};

struct DepEdge {
    string from_path;           // "src/page.tsx" (importer)
    string to_path;             // "src/utils.ts" (imported)
    string import_stmt;         // "import { formatDate } from './utils'"
    string description;         // LLM explanation (added later)
};

struct DepGraph {
    vector<DepNode> nodes;
    vector<DepEdge> edges;
    unordered_map<string, int> path_to_node;  // fast lookup
};
```

**Algorithm (parallel, 8 worker threads):**

1. Collect all source files from the tree
2. Extract imports from each file (tree-sitter or regex)
3. Filter out stdlib imports (`os`, `sys`, `stdio.h`, etc.) and system headers (`<vector>`)
4. Resolve each import path to an actual file
5. For resolved imports, create `DepEdge` entries
6. Create `DepNode` for each file that appears in the graph
7. Populate adjacency lists (`depends_on`, `depended_by`)

**Output:** `dep_graph.json` — JSON file with all nodes and edges

---

### Step 5: Generate LLM Descriptions

This is what makes DGAT special. DGAT calls an LLM (via vLLM, Ollama, OpenAI, etc.) to generate human-readable descriptions.

#### 5a: File Descriptions

For each source file, DGAT sends to the LLM:
- The file's content
- Project README (if exists)
- Folder structure
- Query: "Generate a 3-6 line markdown description of what this file does"

**Example output:**
```markdown
**Core import extraction engine** — uses tree-sitter grammars to parse
import statements from 15+ languages. Falls back to regex patterns
when grammars aren't available. Handles path aliases, relative imports,
and barrel files.
```

**Execution:** Parallel across 8 worker threads (8 LLM requests at once)

#### 5b: Edge Descriptions

After all files are described, for each dependency edge:
- File A's description
- File B's description
- The import statement
- Query: "In one sentence, explain why A imports from B"

**Example output:**
```
page.tsx uses the formatDate utility from utils.ts to display
human-readable timestamps in the activity feed.
```

**Filter:** Only edges where both files have meaningful descriptions (skips external deps)

#### 5c: External Dependency Descriptions

For imports that reference files outside the project (e.g., `npm` packages, library includes):
- The dependency name
- List of files that import it (up to 5)
- Query: "What is this dependency? (one sentence)"

**Example:**
```
React is a JavaScript library for building user interfaces with
component-based architecture.
```

---

### Step 6: Synthesize Project Blueprint

DGAT uses the file descriptions to generate `dgat_blueprint.md` — a top-level architectural overview.

**Process:**
1. Collect all file descriptions
2. Group by directory
3. LLM generates: "Given these files and descriptions, write the project blueprint (5-10 paragraphs)"

**Output:** `dgat_blueprint.md` — markdown file describing the overall architecture

---

### Step 7: Persist State to Disk

All results are saved:

```
file_tree.json           ← TreeNode hierarchy (10-50 KB for typical projects)
dep_graph.json           ← DepGraph with nodes, edges, descriptions
dgat_blueprint.md        ← Project blueprint markdown
```

These files are then used by:
- The frontend to display the UI
- `dgat update` for incremental re-scanning
- `dgat search` for querying
- MCP server for integrating with AI agents

---

## Operating Modes

### Mode 1: Full Scan (`dgat scan`)

```
dgat scan /path/to/project
├─ Walk filesystem → file_tree.json
├─ Extract imports → dep_graph.json (raw)
├─ Call LLM (8 parallel workers) → descriptions
├─ Rebuild dep_graph.json (with descriptions)
├─ Generate blueprint
└─ Start HTTP server on port 8090
```

**Time:** 1-5 minutes for a 200-file project (depends on LLM and network)

---

### Mode 2: Backend Server (`dgat backend`)

```
dgat backend --port 8090
├─ Load file_tree.json from disk
├─ Load dep_graph.json from disk
├─ Start HTTP server
├─ Serve endpoints:
│  ├─ GET /api/tree → file_tree.json
│  ├─ GET /api/dep-graph → dep_graph.json
│  ├─ GET /api/blueprint → dgat_blueprint.md
│  └─ GET / → serve HTML UI
└─ (no LLM calls, no re-scanning)
```

**Time:** Instant (just JSON serving)

---

### Mode 3: Incremental Update (`dgat update`)

The smart re-scan. Only processes changed files.

**Algorithm:**

1. **Load old state**
   ```cpp
   old_hash[rel_path] = saved XXH3-128 from file_tree.json
   old_desc[rel_path] = saved description
   old_dep_graph = saved dep_graph.json
   ```

2. **Build fresh tree**
   ```cpp
   fresh_tree = build_tree()  // filesystem walk, no LLM
   ```

3. **Detect changes**
   ```cpp
   for each file in fresh_tree:
       hash = fast_fingerprint(content)
       if hash != old_hash[rel_path]:
           changed_paths.add(rel_path)  // file changed or is new
       else:
           description = old_desc[rel_path]  // skip LLM, reuse old
   ```

4. **Re-describe only changed files**
   ```cpp
   populate_descriptions_selective(changed_files)  // 8 workers
   ```

5. **Rebuild dependency graph**
   ```cpp
   build_dep_graph()  // import parsing, fast
   
   // For node descriptions:
   if node.source_file in changed_files:
       call LLM to describe external deps
   else:
       copy old description from old_dep_graph_json
   
   // For edge descriptions:
   for each edge:
       if (edge.from or edge.to in changed_files):
           call LLM to describe edge
       else:
           copy old description
   ```

6. **Serialize and save**
   ```cpp
   file_tree.json = new state
   dep_graph.json = new state
   ```

**Performance:** For a 200-file project with 5 files changed:
- Full scan: ~200 LLM calls
- Update: ~5 + (edges touching those 5 files) LLM calls

---

## LLM Integration

DGAT supports multiple LLM providers:

| Provider | Mode | Config |
|----------|------|--------|
| **vLLM** | Local HTTP | `endpoint=http://localhost:8000`, `model=Qwen/Qwen3.5-2B` |
| **Ollama** | Local HTTP | `endpoint=http://localhost:11434/api`, `model=qwen` |
| **OpenAI** | Remote API | `api_key=sk-...`, `model=gpt-4` |
| **Anthropic** | Remote API | `api_key=sk-ant-...`, `model=claude-opus` |
| **OpenRouter** | Remote API | `api_key=...`, `model=google/gemini-3.1-flash-lite-preview` |
| **OpenAI-compatible** | HTTP | Any endpoint using OpenAI protocol |

**How it calls the LLM:**

```cpp
httplib::Client cli(host, port);
json payload = {
    {"model", g_llm_config.model},
    {"messages", {
        {{"role", "user"}, {"content", prompt}}
    }},
    {"temperature", 0.7},
    {"max_tokens", 200}  // short descriptions only
};
cli.Post("/chat/completions", headers, payload.dump());
```

**Parallelization:** 8 worker threads (ThreadPool in dgat.cpp)

---

## File Tree JSON Format

```json
{
  "name": "DGAT",
  "rel_path": ".",
  "is_file": false,
  "hash": "0000000000000000...",
  "children": [
    {
      "name": "dgat.cpp",
      "rel_path": "dgat.cpp",
      "is_file": true,
      "hash": "a1b2c3d4e5f6...",
      "description": "**Core engine** — filesystem walking, import...",
      "depends_on": ["json.hpp", "httplib.h"],
      "depended_by": [],
      "children": []
    },
    {
      "name": "src",
      "rel_path": "src",
      "is_file": false,
      "children": [...]
    }
  ]
}
```

---

## Dependency Graph JSON Format

```json
{
  "nodes": [
    {
      "id": "src/utils.ts",
      "name": "utils.ts",
      "rel_path": "src/utils.ts",
      "description": "**Utility functions** — shared helpers for...",
      "is_file": true,
      "is_gitignored": false,
      "hash": "a1b2c3d4...",
      "depends_on": [],
      "depended_by": ["src/pages/index.tsx"]
    }
  ],
  "edges": [
    {
      "from": "src/pages/index.tsx",
      "to": "src/utils.ts",
      "import_stmt": "import { formatDate } from '../utils'",
      "description": "index.tsx uses formatDate from utils.ts to render..."
    }
  ]
}
```

---

## Frontend UI

The React UI (renderwise-forge-main) displays DGAT results in three panels:

### Left Panel: File Explorer
- Hierarchical tree view of file_tree.json
- Click any file to inspect it in the right panel
- Collapsible folders

### Middle Panel: Blueprint / Graph Tabs
- **Blueprint tab**: Rendered markdown of dgat_blueprint.md
- **Graph tab**: Interactive WebGL visualization (Sigma.js) of dep_graph.json
  - Node size reflects degree (connectivity)
  - Click nodes to select them
  - Click a second node to inspect the edge between them
  - Pan, zoom, search by name

### Right Panel: Inspector
- **Selected file**: Shows description, dependencies, metadata
- **Selected edge**: Shows import statement and edge description
- Updates live as you click around

**Auto-refresh:** Every 30 seconds (polls `/api/tree`, `/api/dep-graph`, `/api/blueprint`)

---

## CLI Commands

| Command | What it does |
|---------|-------------|
| `dgat scan [path]` | Full scan: tree walk → LLM descriptions → save state |
| `dgat update [path]` | Incremental re-scan: only LLM-describe changed files |
| `dgat search <query>` | Search files by name or description |
| `dgat describe <path>` | Get LLM description for one specific file |
| `dgat deps <path>` | Show files that this file imports |
| `dgat dependents <path>` | Show files that import this file |
| `dgat blueprint` | Print the project blueprint |
| `dgat backend --port 8090` | Start HTTP server (serve saved state) |
| `dgat mcp` | Start MCP server (AI agent integration) |
| `dgat config init` | Interactive LLM provider setup |
| `dgat config set <key> <value>` | Configure LLM settings |
| `dgat config test` | Test if the LLM endpoint is working |

---

## Key Design Decisions

### Why C++ with Python Wrapper?

- **C++** handles the heavy lifting: filesystem I/O, parsing, graph construction
- **Python** provides the user-friendly CLI and configuration management
- Python calls the C++ binary via subprocess and parses JSON output

### Why XXH3-128 Fingerprints?

- Fast to compute on every run (even for large files)
- Reliable for detecting changes (128 bits = negligible collision risk)
- Small to store (32 hex characters)
- Enables incremental updates without keeping checksums of old state

### Why Parallel LLM Calls?

- File descriptions are independent → can call LLM 8x in parallel
- Edge descriptions depend on file descriptions → must wait for those to finish first
- ThreadPool (workers + queue) distributes requests fairly

### Why Tree-sitter + Regex?

- **Tree-sitter** is accurate but requires grammars
- **Regex** is imprecise but works everywhere
- Two-tier approach maximizes precision where possible, maintains coverage everywhere

### Why Separate Tree and Graph?

- **Tree**: Filesystem hierarchy (matches how developers think)
- **Graph**: Dependency relationships (flat, edge-focused)
- Tree appears in explorer panel, graph appears in visualization
- External dependencies appear in graph but not in tree

---

## Performance Characteristics

| Task | Time | Notes |
|------|------|-------|
| Walk filesystem (500 files) | ~50ms | Fast, parallel I/O |
| Extract imports (500 files) | ~1-2s | Includes tree-sitter startup |
| LLM descriptions (500 files) | ~10-30 min | Depends on LLM speed & network |
| Rebuild dep graph | ~2s | Fast (just edge creation) |
| **Total full scan** | **10-30 min** | Bottleneck: LLM |
| Backend startup | ~100ms | Just load JSON |
| UI auto-refresh | <1s | Serve pre-computed JSON |

**Update mode** (5 files changed in 500-file project):
- Skip LLM descriptions: 100x speedup on file descriptions
- Still rebuild dep graph (fast): 2s
- **Total**: ~30s instead of 10-30 min

---

## Limitations & Edge Cases

1. **Language support** — only languages with extractors (tree-sitter or regex). Exotic languages might miss some imports.

2. **Dynamic imports** — can't detect `require(variable)` or dynamic imports in Python. Only static text-based extraction.

3. **Type-only imports** — catches them, but they might not represent runtime dependencies.

4. **Barrel file resolution** — assumes `index.ts` or `__init__.py` for re-exports. Some edge cases may not resolve.

5. **Circular dependencies** — detected and preserved in the graph (they're real). Not an error.

6. **Very large projects** — still works but LLM descriptions take proportionally longer.

---

## In Summary

DGAT is a **three-phase system**:

1. **Phase 1 (Fast)**: Walk filesystem, extract imports, build raw dependency graph
2. **Phase 2 (Slow)**: Call LLM in parallel to annotate every file and edge with descriptions
3. **Phase 3 (Instant)**: Serve the saved state via HTTP (UI or MCP)

The magic is that once you've done phases 1-2, you can:
- Run `dgat update` to re-describe only changed files
- Start `dgat backend` anytime to serve the graph via HTTP
- Use `dgat mcp` to integrate with AI agents
- Browse the interactive UI

All with **no configuration**, **no annotations**, **no manual work** — just point DGAT at a directory and it figures out the rest.
