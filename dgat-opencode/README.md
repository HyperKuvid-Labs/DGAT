# dgat-opencode

native opencode integration for dgat — gives your ai coding agent deep codebase understanding through dependency graphs, file context, and impact analysis.

## what it does

when you open a project in opencode with dgat integration:

- the agent instantly understands the project architecture (via dgat blueprint in AGENTS.md)
- it can query any file's full context — dependencies, dependents, edge descriptions
- it knows the blast radius before making changes (impact analysis)
- it can search files by concept, not just name (AI-generated descriptions)
- it detects circular dependencies, orphan files, and entry points

## quick start

```bash
# in any project
bash /path/to/dgat-opencode/setup.sh

# then start coding
opencode
```

that's it. the setup script:
1. scans your project with dgat (if not already scanned)
2. starts the dgat backend server
3. configures opencode with dgat MCP + custom tools
4. copies skills and agent configs
5. appends the dgat blueprint to AGENTS.md

## what gets created

```
your-project/
├── opencode.jsonc          # dgat MCP server config
├── AGENTS.md               # appended with dgat blueprint
└── .opencode/
    ├── tools/
    │   └── dgat.ts         # 4 custom tools (context, impact, search, blueprint)
    ├── skills/
    │   ├── dgat-analyze.md # deep codebase analysis workflow
    │   └── dgat-review.md  # dependency-aware code review
    └── agents/
        └── dgat-architect.json  # architecture analysis persona
```

## tools available in opencode

| tool | what it does |
|---|---|
| `dgat_context` | full file context — description, deps, dependents, complexity |
| `dgat_impact` | blast radius analysis — what breaks if i change this? |
| `dgat_search` | find files by name or AI-generated description |
| `dgat_blueprint` | project architecture overview |

plus 6 more via the MCP server: `dgat_dependencies`, `dgat_dependents`, `dgat_module_summary`, `dgat_circular_deps`, `dgat_entry_points`, `dgat_scan`

## skills

```bash
# analyze the entire codebase
opencode run --skill dgat-analyze

# review a specific file with dependency context
opencode run --skill dgat-review --param file=src/auth/middleware.ts
```

## agent

```bash
# use the architect agent
opencode agent dgat-architect "review the authentication architecture"
```

## how it works

```
opencode session
    │
    ├── reads AGENTS.md → gets dgat blueprint (project architecture)
    │
    ├── MCP server (dgat-mcp) → auto-starts dgat --backend
    │   ├── 10 tools available to the agent
    │   └── auto-starts backend if not running
    │
    └── custom tools (.opencode/tools/dgat.ts)
        └── direct HTTP calls to dgat API (faster for frequent use)
```

## requirements

- dgat installed and in PATH
- opencode installed
- node.js (for MCP server and custom tools)

## manual setup

if you prefer not to use the setup script:

```bash
# 1. scan your project
dgat /path/to/project

# 2. start backend
dgat --backend

# 3. add to opencode.jsonc
{
  "mcp": {
    "dgat": {
      "type": "local",
      "command": ["npx", "-y", "dgat-mcp"],
      "enabled": true
    }
  }
}

# 4. copy tools
mkdir -p .opencode/tools
cp /path/to/dgat-opencode/tools/dgat.ts .opencode/tools/

# 5. append blueprint to AGENTS.md
cat dgat_blueprint.md >> AGENTS.md
```
