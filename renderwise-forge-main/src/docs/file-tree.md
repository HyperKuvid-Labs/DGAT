# File Tree

The file tree is DGAT's foundational data structure. Before any import parsing or LLM calls happen, the engine walks the filesystem and builds a `TreeNode` for every file and directory it encounters.

## TreeNode structure

```cpp
struct TreeNode {
    string name;                    // filename or directory name
    int version;                    // numeric id used for DOT graph node labels
    digest_t hash;                  // XXH3-128 fingerprint of file content
    string abs_path;                // absolute path on the system
    string rel_path;                // path relative to project root (the key identifier)
    vector<unique_ptr<TreeNode>> children;
    bool is_file;                   // true = file, false = directory
    vector<json> error_traces;      // [{"error": "...", "timestamp": "...", "solution": "..."}]
    string description;             // LLM-generated markdown description of the file
    vector<string> depends_on;      // files this file imports/requires
    vector<string> depended_by;     // files that import this file
};
```

## What each field does and why it exists

### `name`
Just the filename or directory name — `dgat.cpp`, `src`, `utils.ts`. Used for display purposes in the UI tree view and DOT export. Nothing clever here.

### `version`
A numeric id assigned during DOT graph export. When the tree gets serialized to Graphviz format, each node needs a unique identifier like `n0`, `n1`, `n2`. The `version` field is that id. It's not used anywhere else — just a bridge between the in-memory tree and the DOT output.

### `hash`
The XXH3-128 fingerprint of the file's content. This is the backbone of incremental updates. When you run `dgat update`, the engine recomputes this hash for every file and compares it against the saved value. If the hash matches, the file hasn't changed — skip the LLM call, copy the old description. If it differs, re-describe.

The hash is a `digest_t` (two `uint64_t` values from XXH3-128), serialized to a 32-character hex string in JSON. 128 bits is overkill for change detection, but XXH3 is fast enough that the extra bits cost nothing.

### `abs_path`
The full absolute path on disk. Needed for actually reading the file content when it's time to send it to the LLM. The engine needs to open the file — `rel_path` alone won't do that.

### `rel_path`
**This is the most important field.** Every cross-reference in the entire system uses `rel_path` as the identifier. Dependency edges point from one `rel_path` to another. The frontend uses it as the node id in the graph. Hash lookups during update mode key off `rel_path`.

It's the path relative to the project root: `src/utils/helpers.ts`, not `/home/user/project/src/utils/helpers.ts`. This makes the state portable — you can move the project directory and the saved JSON still makes sense.

### `children`
The recursive structure. Directories hold `unique_ptr<TreeNode>` children, files have an empty vector. The tree is built in sorted directory order for deterministic output. Symlinks are guarded against to avoid infinite recursion — if a path is a symlink, the node is created but its children aren't traversed.

### `is_file`
Simple discriminator. `true` means this node represents a file, `false` means it's a directory. Controls rendering in the UI (file icon vs folder icon), DOT export shape (`note` vs `folder`), and traversal logic.

### `error_traces`
A vector of JSON objects for tracking errors encountered during processing. Each entry has an error message, timestamp, and suggested solution. This is a placeholder for now — the infrastructure is there but not actively populated. The idea is that if a file fails LLM description or import parsing, the error gets recorded here instead of silently swallowed.

### `description`
The LLM-generated markdown description of what the file does. This is the whole point of the tool — turning a raw file path into something a human can understand at a glance.

The prompt gives the model the file's content, the project README, and the folder structure, and asks for 3-6 lines: one bold sentence about the file's purpose, followed by a tight bullet list of key responsibilities. The output is stored as-is in this field.

For files that weren't processed (binary files, dgatignore'd files, etc.), this field contains a short explanation like `"Binary or non-text file skipped."`

### `depends_on` / `depended_by`
These get populated after the dependency graph is built. `depends_on` lists the `rel_path` values of files this file imports. `depended_by` lists the `rel_path` values of files that import this one.

They're denormalized from the `DepGraph` back into the tree so the frontend can show dependency info directly on tree nodes without cross-referencing the graph.

## How the tree is built

The `build_tree()` function does a recursive directory walk starting from the given root path. For each entry:

1. **Skip filters** — `.git`, dependency manifest files (`package.json`, `Cargo.toml`, etc.), build artifacts (`build/`, `dist/`, `target/`), anything matching `.gitignore` or `.dgatignore`
2. **Create the node** — with name, paths, and `is_file` flag
3. **Symlink guard** — if it's a symlink, stop here (don't recurse into it)
4. **Recurse children** — if it's a directory, sort entries by name and recurse

The result is a pruned, clean representation of the project's filesystem structure.

## Serialization

The tree gets serialized to JSON via `tree_to_json()` and written to `file_tree.json`. Every field is included — the frontend needs the full picture for the inspector panel. The `children` array is recursive, so the entire tree structure is captured in a single JSON document.

```json
{
  "name": "DGAT",
  "rel_path": ".",
  "is_file": false,
  "children": [
    {
      "name": "dgat.cpp",
      "rel_path": "dgat.cpp",
      "is_file": true,
      "hash": "a1b2c3d4e5f6...",
      "description": "**Core engine** — handles filesystem walking...",
      "depends_on": ["json.hpp", "httplib.h"],
      "depended_by": [],
      "children": []
    }
  ]
}
```

## Why a tree and not a flat list?

The tree structure mirrors how developers think about codebases — as nested directories with files inside them. The UI's explorer panel renders it as a collapsible file tree, which is the most natural way to navigate a project. A flat list would lose the directory context and make the UI feel wrong.

The tree is also what gets exported to DOT format for Graphviz visualization, where the parent-child relationships become directed edges in the graph output.
