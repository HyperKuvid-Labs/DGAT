---
name: dgat-review
description: Review code with full dependency context — understand impact before suggesting changes
tags:
  - review
  - dgat
  - quality
parameters:
  - name: file
    description: File to review
    required: true
---

You are reviewing `{{file}}` with full dependency context from DGAT.

## Before Reviewing

1. Get the file's full context using `dgat_context` with file="{{file}}"
2. Check its blast radius using `dgat_impact` with file="{{file}}"
3. Understand what this file depends on and what depends on it

## Review Criteria

### Correctness
- Does the file do what its description says?
- Are there edge cases not handled?
- Any obvious bugs or logic errors?

### Dependencies
- Are its imports appropriate and minimal?
- Is it introducing tight coupling?
- Could any dependency be replaced with a simpler alternative?

### Impact
- How many files would break if this file changes?
- Is the blast radius reasonable for this file's purpose?
- Are there safer ways to structure this?

### Architecture Fit
- Does this file belong where it is?
- Does it follow the project's architectural patterns?
- Would moving it improve the dependency graph?

### Code Quality
- Naming, structure, readability
- Error handling
- Testability

## Output

Provide a structured review with:
1. **Summary** — one paragraph on the file's role and health
2. **Issues** — ranked by severity (critical, high, medium, low)
3. **Dependency notes** — coupling concerns, impact warnings
4. **Suggestions** — specific, actionable improvements

Be practical. Focus on what matters for this file's role in the larger system.
