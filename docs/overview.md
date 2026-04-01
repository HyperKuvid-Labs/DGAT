# Overview

DGAT (Dependency Graph as a Tool) is a C++17 engine that scans any codebase, extracts import relationships, generates natural-language descriptions for every file and dependency edge using a local LLM, and serves the result through an interactive UI.

No config files. No manual annotations. Point it at a directory and it figures out the rest.

## How it works, end to end

```
dgat [path]
  │
  ├─ 1. Walk the directory tree
  │     Skip .git, build artifacts, .gitignore, .dgatignore
  │     Build a TreeNode for every file and folder
  │
  ├─ 2. Parse imports (tree-sitter + regex fallback)
  │     Extract import/require/include/use statements
  │     Resolve relative paths, path aliases (@/...), Python dotted imports
  │     Build a dependency graph (DepNode + DepEdge)
  │
  ├─ 3. Describe files via LLM (vLLM HTTP API)
  │     Each file's content + context → short markdown description
  │     Runs in parallel across 8 workers
  │
  ├─ 4. Describe dependency edges via LLM
  │     "What does file A use from file B and why?"
  │     One tight sentence per edge
  │
  ├─ 5. Generate project blueprint
  │     All file descriptions → dgat_blueprint.md
  │
  └─ 6. Persist state
        file_tree.json + dep_graph.json → disk
```

## Two modes of operation

**Full scan** (`dgat [path]`) — walks the filesystem, parses imports, calls the LLM for descriptions, builds the dependency graph, generates a blueprint, saves everything to disk.

**Backend server** (`dgat --backend`) — loads the saved JSON state from disk, starts an HTTP server on port 8090. The frontend hits `/api/tree`, `/api/dep-graph`, `/api/blueprint` to render the UI. No LLM calls, no re-scanning.

**Incremental update** (`dgat update`) — the smart one. Recomputes XXH3 fingerprints for every file, compares against saved hashes, re-describes only the files that actually changed. Everything else gets copied from the old state.

## What makes it different

Most code visualization tools stop at drawing boxes and arrows. DGAT goes further — every node in the graph carries a natural-language description of what that file does, and every edge explains the relationship between two files in plain English. The LLM isn't a gimmick here; it's the annotation layer that turns a raw dependency graph into something you can actually reason about.

The engine is built in C++ for speed — filesystem walking, import parsing, and graph construction all run in parallel. The LLM calls are the only network-bound part, and even those are batched across 8 worker threads.

## Key design decisions

- **XXH3-128 fingerprints** for change detection — fast enough to recompute on every run, stable enough to trust for incremental updates
- **Tree-sitter first, regex fallback** — precision when the grammar is available, coverage when it isn't
- **State persistence on disk** — the scan and the UI are decoupled. Scan once, serve many times
- **No cloud dependencies** — vLLM runs locally, everything stays on your machine
