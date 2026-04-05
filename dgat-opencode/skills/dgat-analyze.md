---
name: dgat-analyze
description: Perform a deep codebase analysis using DGAT's dependency graph and AI-generated descriptions
tags:
  - analysis
  - architecture
  - dgat
---

You are conducting a comprehensive codebase analysis using DGAT tools.

## Steps

1. **Get the blueprint** — use `dgat_blueprint` to understand the overall architecture
2. **Find entry points** — identify the main files that drive the application
3. **Check for issues** — look for circular dependencies and orphan files
4. **Analyze key modules** — pick 2-3 important directories and use `dgat_module_summary` on each
5. **Review complexity** — find files with the highest blast radius using `dgat_impact`

## Report

Provide a structured analysis covering:

### Architecture Overview
- What this project does
- Main components and how they connect
- Technology stack and patterns

### Key Files
- Entry points and their roles
- Most-connected files (high dependency count)
- Files with the largest blast radius

### Concerns
- Circular dependencies (if any)
- Orphan files (potential dead code)
- Overly coupled modules
- Files that are risky to change

### Recommendations
- Suggested refactoring opportunities
- Files that need better documentation
- Architectural improvements

Use the DGAT tools for every step — don't guess, query the actual dependency graph.
