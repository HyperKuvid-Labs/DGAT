# DGAT Software Blueprint

## Project Overview
FFF (Fuzzy Neovim) is a high-performance fuzzy file finder and agent memory tool for Neovim. It combines rough-glob based indexing with Smith-Waterman fuzzy matching to provide typo-resistant, multiline results. The project uses a Rust/CFFI frontend for package search and indexing, alongside a Lua environment for UI and file system invocation, tightly integrated with AI agents and Git status integration.

## Architecture
The system operates on a **double-runtime** architecture compatible with vanilla JS, TypeScript, and Lua.

1.  **Frontend (Neovim Workspace)**:
    *   **Tooling**: Built on the Fiery Code Repository (implemented via a fork of the `eventually`, `fehest`, and `plenary` crates).
    *   **Responsibilities**:
        *   Manages the root directory and signature of the available programs.
        *   Handles fuzzy search and file selection based on cache or fuzzy logic.
        *   Provides a global keybind to open a native search instance.
    *   **Support Extensibility**: Integrates external tools (Python, Ruby, C) via configuration files.

2.  **Backend (Library & Plugin)**:
    *   **Library**: `fff-core`. Responsible for vector-based fuzzy matching, indexing, and performance-optimized file operations (e.g., MEMVAC, Aho-Corasick).
    *   **Tooling**: `fff-c` (CFFI bindings) and `fff-nvim` (Neovim plugin layer) provide the live fuzzy grammers and file explorer APIs.

3.  **UI & Interaction**:
    *   **LUA**: Handles the UI rendering (renderers, UI components) and configuration.
    *   **BUILD SCRIPTS**: Manages the build process for native frontends (Linux x86_64/aarch64, Darwin aarch64, etc.) and compiles pre-compiled native libs.

4.  **Agent Integration**:
    *   **MCP (Model Context Protocol)**: Exposes APIs for searching open drawdowns, windows, and code files.
    *   **Rust Global Tools**: Introspects Rust global tools to access `ffi`.
    *   **Background Execution**: Handles heavy workloads asynchronously.

## Technical Details
*   **Search Engine**: Employs Aho-Corasick and SIMD-accelerated matching. Supports multiple query patterns via `ife`.
*   **Performance Optimization**:
    *   **LUA**: Uses callbacks for complex operations to bypass line-counter checks during heavy rendering.
    *   **BUILD TIMING**: Optimizes linking to use `.tgz` archives for quick builds.
    *   **CI**: Uses `Bun` for dependency inference and documentation generation (`panvimdoc.yaml`).
*   **Optimization Strategy**:
    *   **Tuning**: Uses `tt` (utilization tuning) for high-readworkloads.
    *   **Memory**: Caching files on disk (SQLite) to avoid read contention while maintaining a soft-cache in RAM.
*   **Cross-Platform**:
    *   **Linux**: Uses `libffi` for low-level interpolation.
    *   **Darwin (macOS)**: Uses Dynamic Linking to handle large file systems safely.
    *   **Windows**: Emulates native interop where possible.
*   **QA**: Includes `luacheck` and `stylua` for strict code formatting. IaC is enforced via `rkt` and `flux`.