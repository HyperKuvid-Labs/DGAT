# DGAT Software Blueprint

## Project Overview
DGAT (Dependency Graph as a Tool) is an offline codebase analysis system that synchronizes text-based descriptions of project files with tree-sitter syntax trees, resolving cross-language import relationships. Unlike centralized CI systems, DGAT runs locally using a minimal vLLM inference server to generate natural language artifacts for every dependency relationship, merging data into a unified JSON dependency graph and Markdown architectural blueprint.

## Architecture
The system operates as a tightly coupled backend-unit frontend pipeline:

1.  **Orchestrator (`dgat.cpp`)**:
    *   **Entry Point**: Scans the directory tree (ignoring `.dgatignore`) and walks into build artifacts (skipping `build/`).
    *   **Fingerprinting**: Applies a truncated XXH3 hash to each walk to ensure deterministic, consistent results regardless of execution order.
    *   **Parsing**: Utilizes `tree-sitter` to parse language-specific import trees and resolve aliases based on `tsconfig.json`.
    *   **Inference**: Dispatches tasks to a local Qwen3.5-2B model via vLLM to generate semantic descriptions for files and edges.
    *   **Aggregation**: Merges all descriptions into a structured `DepNode` (dependency) and `DepEdge` (dependency relationship) data structures.

2.  **Frontend Interface (`frontend/`)**:
    *   **Next.js App**: Deploys static exports for an interactive web interface.
    *   **Components**: Handled via `components.json` and `src/app` logic to render visualizations.
    *   **Data Handling**: Consumes JSON parsers from internal types, processes the Blueprint and Graph outputs for rendering.

3.  **GUI Components (`docs/` & `.vscode/`)**:
    *   **Blueprint Panel**: Displays the top-down Markdown/HTML narrative derived from the final Mermaid diagram.
    *   **Graph Explorer**: Visualizes the dependency graph with node-level inspection and edge-level debugging capabilities.
    *   **File Inspector**: Contextualized file detail view, unlocking source-inclusion logic and showing `fileref.json` compatibility.

## Technical Details
*   **Languages & Libraries**:
    *   **Parsing**: `tree-sitter` (multi-language support via `container.h`).
    *   **Serialization**: Custom `json.hpp` and `inline.hpp` implemented as extensions to standard C++17 for complex graph structures (`DepNode`, `DepEdge`).
    *   **Inference**: `vLLM` running a local 2B parameter model (Qwen3.5) to synthesize text for static imports.
    *   **Fingerprinting**: XXH3 (128-bit) hashing.
*   **Configuration & State**:
    *   **State Persistence**: `.claude/settings.local.json` configuration.
    *   **Exclusions**: `.dgatignore` rules that silently block binary paths, build artifacts, and inferred `.gitkeep` files.
*   **UI Lifecycle**:
    *   Generates a sequence of screens (Installation -> CLI Scan -> Inspector -> Blueprint) that are toggled via URL parameters or Progressive App features in Next.js.
    *   Supports static reporting (screenshots) and dynamic runtime generation.