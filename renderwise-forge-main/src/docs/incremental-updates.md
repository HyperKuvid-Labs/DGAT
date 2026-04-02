# Incremental Updates

Running a full scan on a large codebase takes time — the LLM calls are the bottleneck. If you've already scanned a project and only changed a few files, re-describing everything from scratch is wasteful. That's what `dgat update` solves.

## The core idea

Every file gets an XXH3-128 fingerprint when it's first described. On subsequent runs, the engine recomputes the fingerprint and compares it against the saved value. If the hash matches, the file hasn't changed — copy the old description and skip the LLM call. If it differs, re-describe that file only.

This turns an O(n) LLM call problem into an O(changed) problem. For a 200-file project where you edited 3 files, that's 3 LLM calls instead of 200.

## How the diff works

The `run_update_mode()` function handles the entire flow:

### Step 1: Load old state

Read `file_tree.json` and `dep_graph.json` from disk. Build lookup maps:
- `old_hash[rel_path]` → saved XXH3-128 hex string
- `old_desc[rel_path]` → saved LLM description

These maps are flat, keyed by `rel_path`, because the tree structure doesn't matter for comparison — we only care about individual files.

### Step 2: Build fresh tree

Walk the filesystem again with `build_tree()`. This is fast — no LLM calls, just directory traversal. The tree reflects the current state of the project: new files appear, deleted files are gone, renamed files show up with new paths.

### Step 3: Compute hashes and detect changes

For each file in the fresh tree:
1. Read the file content
2. Compute XXH3-128 fingerprint via `fast_fingerprint()`
3. Serialize to hex string
4. Compare against `old_hash[rel_path]`

If the file is new (not in `old_hash`) or the hash differs, add its `rel_path` to the `changed_paths` set.

If the hash matches, copy the old description directly into the tree node and mark it as done — no LLM call needed.

### Step 4: Re-describe changed files

Collect `TreeNode*` pointers for only the changed files and pass them to `populate_descriptions_selective()`. This is the same LLM-powered description function as the full scan, but it only processes the subset of files that actually changed.

### Step 5: Rebuild dependency graph

The dependency graph is rebuilt from scratch — this is fast since it's just import parsing, no LLM calls. After the raw graph is built:

- **Node descriptions**: For dependency nodes whose source file didn't change, copy the old description from `old_dep_graph_json`. For external/gitignored dependencies, run `populate_dependency_descriptions()` (which already skips nodes with real descriptions).

- **Edge descriptions**: Build a lookup of old edge descriptions keyed by `"from_path|||to_path"`. For edges where neither endpoint changed, copy the old description. For edges touching changed files, run `populate_edge_descriptions()`.

### Step 6: Sync and save

Copy `depends_on` and `depended_by` from the graph back into tree nodes. Serialize everything to `file_tree.json` and `dep_graph.json`.

## What counts as a change

The fingerprint is computed from the raw file content after UTF-8 sanitization. Any byte-level change to the file will produce a different hash — even whitespace changes, comment edits, or formatting adjustments.

This is intentional. If you touched the file, the description might need updating. The hash doesn't try to be smart about semantic changes — it's a simple, reliable signal that the file is different from what was last scanned.

## What doesn't trigger a re-description

- **Unchanged files** — same hash, same description, copied from old state
- **Deleted files** — they don't appear in the fresh tree, so they're simply absent from the new state
- **Renamed files** — treated as a new file (new `rel_path`, no old hash to compare against) plus the old path disappearing from the tree. The old description is lost, which is correct — a renamed file might have a different role now.

## Edge cases

### New files
A file that didn't exist in the old state has no entry in `old_hash`, so it's automatically treated as changed and gets described.

### Removed files
Files that existed in the old state but not in the fresh tree simply don't appear in the output. The new `file_tree.json` reflects the current filesystem, not the historical one.

### Dependency graph changes
Even if no file content changed, the dependency graph can change if import relationships were modified. Since the graph is rebuilt from scratch on every update, new edges appear and stale edges disappear automatically. The edge description pass only runs on edges touching changed files, so edges between two unchanged files keep their old descriptions.

## Performance characteristics

| Operation | Full scan | Update mode |
|---|---|---|
| Filesystem walk | O(n) | O(n) |
| Hash computation | O(n) | O(n) |
| LLM file descriptions | O(n) | O(changed) |
| Import parsing | O(n) | O(n) |
| LLM edge descriptions | O(edges) | O(edges touching changed) |
| Graph rebuild | O(n + edges) | O(n + edges) |

For a project with 500 files where 5 files changed, update mode reduces LLM calls from ~500 + ~edges to ~5 + ~edges_touching_5_files. The filesystem walk and import parsing still run on all files, but those are fast — the LLM is the bottleneck.

## When to use update vs full scan

Use `dgat update` when you've made small edits to an already-scanned project. Use a full scan (`dgat [path]`) when:
- Scanning a project for the first time
- You've done major refactoring (renamed files, restructured directories)
- The saved state is out of sync with the filesystem for any reason

The update mode is optimistic — it trusts the hashes. If something feels off, a full scan is the reset button.
