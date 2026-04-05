#!/usr/bin/env bash
# dgat-opencode setup — one-command integration for any project
# usage: bash setup.sh [path/to/project]

set -e

PROJECT_ROOT="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  dgat-opencode setup"
echo "========================================"
echo ""

# check dgat is installed
if ! command -v dgat &> /dev/null; then
  echo "error: dgat not found in PATH"
  echo "install it first: https://github.com/your-org/dgat"
  exit 1
fi
echo "[ok] dgat is installed: $(which dgat)"

cd "$PROJECT_ROOT"

# scan project if no state exists
if [ ! -f "file_tree.json" ]; then
  echo "[scan] no dgat state found — scanning project..."
  dgat "$PROJECT_ROOT"
  echo "[scan] complete"
else
  echo "[ok] dgat state already exists"
fi

# check if backend is running, start if not
if ! curl -s http://localhost:8090/health &> /dev/null; then
  echo "[backend] starting dgat --backend..."
  dgat --backend &
  sleep 2
  echo "[backend] started on port 8090"
else
  echo "[ok] dgat backend already running"
fi

# create opencode.jsonc with dgat mcp config if it doesn't exist
if [ ! -f "opencode.jsonc" ] && [ ! -f "opencode.json" ]; then
  cat > opencode.jsonc << 'JSONC'
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
JSONC
  echo "[config] created opencode.jsonc with dgat mcp"
else
  CONFIG_FILE="opencode.jsonc"
  [ -f "opencode.json" ] && CONFIG_FILE="opencode.json"
  if ! grep -q '"dgat"' "$CONFIG_FILE" 2>/dev/null; then
    echo "[config] adding dgat mcp to $CONFIG_FILE"
    # simple approach: append dgat mcp entry
    sed -i.bak 's/"mcp": {/"mcp": {\n    "dgat": {\n      "type": "local",\n      "command": ["npx", "-y", "dgat-mcp"],\n      "enabled": true\n    },/' "$CONFIG_FILE"
    echo "[config] updated $CONFIG_FILE"
  else
    echo "[ok] dgat mcp already configured in $CONFIG_FILE"
  fi
fi

# create .opencode/tools/dgat.ts
mkdir -p .opencode/tools
cp "$SCRIPT_DIR/tools/dgat.ts" .opencode/tools/dgat.ts
echo "[tools] created .opencode/tools/dgat.ts"

# create skills
mkdir -p .opencode/skills
cp "$SCRIPT_DIR/skills/dgat-analyze.md" .opencode/skills/dgat-analyze.md 2>/dev/null && echo "[skills] created dgat-analyze.md"
cp "$SCRIPT_DIR/skills/dgat-review.md" .opencode/skills/dgat-review.md 2>/dev/null && echo "[skills] created dgat-review.md"

# create agent
mkdir -p .opencode/agents
cp "$SCRIPT_DIR/agents/dgat-architect.json" .opencode/agents/dgat-architect.json 2>/dev/null && echo "[agent] created dgat-architect.json"

# append blueprint to AGENTS.md if it exists
if [ -f "dgat_blueprint.md" ]; then
  if [ -f "AGENTS.md" ]; then
    if ! grep -q "Project Architecture (from DGAT)" AGENTS.md 2>/dev/null; then
      echo "" >> AGENTS.md
      echo "## Project Architecture (from DGAT)" >> AGENTS.md
      echo "" >> AGENTS.md
      cat dgat_blueprint.md >> AGENTS.md
      echo "[context] appended dgat blueprint to AGENTS.md"
    else
      echo "[ok] dgat blueprint already in AGENTS.md"
    fi
  else
    cp dgat_blueprint.md AGENTS.md
    echo "[context] created AGENTS.md from dgat blueprint"
  fi
fi

echo ""
echo "========================================"
echo "  setup complete"
echo "========================================"
echo ""
echo "tools available in opencode:"
echo "  dgat_context      — get full file context with dependencies"
echo "  dgat_impact       — blast radius analysis before edits"
echo "  dgat_search       — find files by name or description"
echo "  dgat_blueprint    — project architecture overview"
echo ""
echo "skills available:"
echo "  dgat-analyze      — deep codebase analysis"
echo "  dgat-review       — dependency-aware code review"
echo ""
echo "agent available:"
echo "  dgat-architect    — architecture analysis persona"
echo ""
echo "start coding: opencode"
