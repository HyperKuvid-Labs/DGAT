# 05 — Setup OpenCode Integration

OpenCode is an AI-powered CLI coding agent. DGAT integrates with it so the agent understands your codebase architecture automatically.

## What You Get

When OpenCode is configured with DGAT, the AI agent can:

- Read the project blueprint (auto-generated architecture overview)
- Query any file's full context (dependencies, dependents, descriptions)
- Analyze blast radius before making changes
- Search files by concept, not just name
- Detect circular dependencies, orphan files, and entry points

## Step 1: Scan Your Project with DGAT

Before integrating with OpenCode, your project needs a DGAT scan:

```bash
# Scan your project (replace with your project path)
./build/dgat /path/to/your/project
```

This creates `file_tree.json`, `dep_graph.json`, and `dgat_blueprint.md` in the project root.

## Step 2: Start the DGAT Backend

```bash
./build/dgat --backend
```

This starts an HTTP API server on port 8090 that serves the dependency graph data.

## Step 3: Configure OpenCode in Your Project

Create (or edit) `opencode.jsonc` in your project root:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "dgat": {
      "type": "local",
      "command": ["npx", "-y", "dgat-mcp"],
      "enabled": true
    }
  }
}
```

This tells OpenCode to start the DGAT MCP server automatically when you open a session.

## Step 4: Add Blueprint to AGENTS.md

Append the DGAT blueprint to your project's `AGENTS.md` so the AI agent reads it on startup:

```bash
# In your project root
cat /path/to/your/project/dgat_blueprint.md >> AGENTS.md
```

If `AGENTS.md` doesn't exist, create it:

```bash
echo "# Project Architecture" > AGENTS.md
cat /path/to/your/project/dgat_blueprint.md >> AGENTS.md
```

## Step 5: Copy DGAT Skills (Optional but Recommended)

Skills are reusable workflows the agent can invoke:

```bash
# In your project root
mkdir -p .opencode/skills
cp /path/to/dgat/dgat-opencode/skills/dgat-analyze.md .opencode/skills/
cp /path/to/dgat/dgat-opencode/skills/dgat-review.md .opencode/skills/
```

## Step 6: Start OpenCode

```bash
# In your project directory
opencode
```

The agent will now have full access to DGAT tools and understand your project architecture.

## Using DGAT Skills in OpenCode

```bash
# Analyze the entire codebase
opencode run --skill dgat-analyze

# Review a specific file with dependency context
opencode run --skill dgat-review --param file=src/auth/middleware.ts
```

## Available Tools in OpenCode

Once configured, these tools are available to the AI agent:

| Tool | Purpose |
|---|---|
| `dgat_context` | Full file context — description, deps, dependents, complexity |
| `dgat_impact` | Blast radius — what breaks if I change this file? |
| `dgat_search` | Find files by name or AI-generated description |
| `dgat_blueprint` | Get the project architecture overview |

Plus 6 more via the MCP server: `dgat_dependencies`, `dgat_dependents`, `dgat_module_summary`, `dgat_circular_deps`, `dgat_entry_points`, `dgat_scan`.

> **Next:** [06 — Setup MCP Server](06-setup-mcp.md)
