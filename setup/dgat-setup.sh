#!/usr/bin/env bash
# dgat-setup.sh — one-command setup for any project
# Scans project, configures opencode, starts backend, verifies routes
#
# Usage:
#   bash setup/dgat-setup.sh              # setup current directory
#   bash setup/dgat-setup.sh /path/to/project  # setup specific project
#
# What it does:
#   1. Finds the dgat binary (PATH or ./build/dgat)
#   2. Scans the project if no state exists
#   3. Creates opencode.jsonc with MCP config (idempotent)
#   4. Appends dgat_blueprint.md to AGENTS.md (idempotent)
#   5. Copies skills, tools, agents to .opencode/ (idempotent)
#   6. Builds dgat-mcp server if not already built
#   7. Starts dgat --backend if not running
#   8. Verifies all API routes are serving

set -euo pipefail

# ── colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
ok()      { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }
step()    { echo -e "\n${BOLD}── $1 ──${NC}"; }

# ── paths ───────────────────────────────────────────────────────────────────
PROJECT_ROOT="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# dgat-opencode lives either next to setup/ (when run from setup/)
# or one level up (when run from dgat-opencode/)
if [ -d "$SCRIPT_DIR/../dgat-opencode" ]; then
  DGAT_OPENCODE_DIR="$SCRIPT_DIR/../dgat-opencode"
elif [ -d "$SCRIPT_DIR/tools" ] && [ -d "$SCRIPT_DIR/skills" ]; then
  DGAT_OPENCODE_DIR="$SCRIPT_DIR"
else
  error "Cannot find dgat-opencode directory"
  exit 1
fi

# dgat-mcp source
DGAT_MCP_DIR="$SCRIPT_DIR/../dgat-mcp"

# ── header ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║          DGAT + OpenCode Setup           ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
info "Project: $PROJECT_ROOT"
info "Script:  $SCRIPT_DIR"
echo ""

cd "$PROJECT_ROOT"

# ── 1. Find dgat binary ───────────────────────────────────────────────────
step "1. Finding dgat binary"

DGAT_BIN=""

# Check if dgat is in PATH
if command -v dgat &> /dev/null; then
  DGAT_BIN="dgat"
  ok "Found in PATH: $(which dgat)"
# Check ./build/dgat (common in dev)
elif [ -x "./build/dgat" ]; then
  DGAT_BIN="./build/dgat"
  ok "Found at ./build/dgat"
# Check ../build/dgat (if running from a subdirectory)
elif [ -x "../build/dgat" ]; then
  DGAT_BIN="../build/dgat"
  ok "Found at ../build/dgat"
# Check script sibling
elif [ -x "$SCRIPT_DIR/../build/dgat" ]; then
  DGAT_BIN="$SCRIPT_DIR/../build/dgat"
  ok "Found at $DGAT_BIN"
else
  error "dgat binary not found"
  echo ""
  echo "Build it first:"
  echo "  cmake -B build && cmake --build build -j\$(nproc)"
  echo ""
  echo "Or install globally:"
  echo "  bash install.sh"
  exit 1
fi

# ── 2. Scan project if needed ─────────────────────────────────────────────
step "2. Checking project state"

if [ ! -f "file_tree.json" ] || [ ! -f "dep_graph.json" ]; then
  warn "No DGAT state found — scanning project..."
  echo ""
  $DGAT_BIN "$PROJECT_ROOT"
  echo ""
  if [ -f "file_tree.json" ] && [ -f "dep_graph.json" ]; then
    ok "Scan complete — file_tree.json and dep_graph.json created"
  else
    error "Scan failed — expected output files not found"
    exit 1
  fi
else
  ok "DGAT state already exists (file_tree.json, dep_graph.json)"
fi

if [ -f "dgat_blueprint.md" ]; then
  ok "Blueprint exists (dgat_blueprint.md)"
else
  warn "No blueprint found — it should have been generated during scan"
fi

# ── 3. Configure opencode.jsonc ────────────────────────────────────────────
step "3. Configuring opencode.jsonc"

MCP_CONFIG='{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "dgat": {
      "type": "local",
      "command": ["npx", "-y", "dgat-mcp"],
      "enabled": true
    }
  }
}'

if [ ! -f "opencode.jsonc" ] && [ ! -f "opencode.json" ]; then
  echo "$MCP_CONFIG" > opencode.jsonc
  ok "Created opencode.jsonc with DGAT MCP config"
else
  CONFIG_FILE="opencode.jsonc"
  [ -f "opencode.json" ] && CONFIG_FILE="opencode.json"

  if grep -q '"dgat"' "$CONFIG_FILE" 2>/dev/null; then
    ok "DGAT MCP already configured in $CONFIG_FILE"
  else
    warn "Adding DGAT MCP to $CONFIG_FILE"
    # Backup original
    cp "$CONFIG_FILE" "${CONFIG_FILE}.bak"
    # Use python for reliable JSON manipulation if available, else sed
    if command -v python3 &> /dev/null; then
      python3 -c "
import json, sys, re

with open('$CONFIG_FILE', 'r') as f:
    content = f.read()

# Strip comments for parsing
content_clean = re.sub(r'//.*$', '', content, flags=re.MULTILINE)

try:
    config = json.loads(content_clean)
except json.JSONDecodeError:
    print('Warning: Could not parse JSON, appending manually')
    sys.exit(1)

if 'mcp' not in config:
    config['mcp'] = {}

config['mcp']['dgat'] = {
    'type': 'local',
    'command': ['npx', '-y', 'dgat-mcp'],
    'enabled': True
}

with open('$CONFIG_FILE', 'w') as f:
    json.dump(config, f, indent=2)
    f.write('\n')
" && ok "Updated $CONFIG_FILE with DGAT MCP" || warn "Could not parse $CONFIG_FILE — manual edit needed"
    else
      # Fallback: simple sed approach
      sed -i.bak 's/"mcp": {/"mcp": {\n    "dgat": {\n      "type": "local",\n      "command": ["npx", "-y", "dgat-mcp"],\n      "enabled": true\n    },/' "$CONFIG_FILE"
      ok "Updated $CONFIG_FILE with DGAT MCP (sed fallback)"
    fi
  fi
fi

# ── 4. Append blueprint to AGENTS.md ──────────────────────────────────────
step "4. Configuring AGENTS.md"

if [ -f "dgat_blueprint.md" ]; then
  if [ -f "AGENTS.md" ]; then
    if grep -q "Project Architecture (from DGAT)" AGENTS.md 2>/dev/null; then
      ok "DGAT blueprint already in AGENTS.md"
    else
      echo "" >> AGENTS.md
      echo "## Project Architecture (from DGAT)" >> AGENTS.md
      echo "" >> AGENTS.md
      cat dgat_blueprint.md >> AGENTS.md
      ok "Appended DGAT blueprint to AGENTS.md"
    fi
  else
    echo "# Project Architecture" > AGENTS.md
    echo "" >> AGENTS.md
    cat dgat_blueprint.md >> AGENTS.md
    ok "Created AGENTS.md from DGAT blueprint"
  fi
else
  warn "No dgat_blueprint.md found — skipping AGENTS.md update"
fi

# ── 5. Copy skills, tools, agents ─────────────────────────────────────────
step "5. Copying DGAT integration files"

# Tools
mkdir -p .opencode/tools
if [ -f ".opencode/tools/dgat.ts" ]; then
  ok "Tools already exist (.opencode/tools/dgat.ts)"
elif [ -f "$DGAT_OPENCODE_DIR/tools/dgat.ts" ]; then
  cp "$DGAT_OPENCODE_DIR/tools/dgat.ts" .opencode/tools/dgat.ts
  ok "Copied dgat.ts to .opencode/tools/"
else
  warn "dgat.ts not found in $DGAT_OPENCODE_DIR/tools/"
fi

# Skills
mkdir -p .opencode/skills
SKILLS_COPIED=0
for skill in dgat-analyze.md dgat-review.md; do
  if [ -f ".opencode/skills/$skill" ]; then
    ok "Skill already exists (.opencode/skills/$skill)"
  elif [ -f "$DGAT_OPENCODE_DIR/skills/$skill" ]; then
    cp "$DGAT_OPENCODE_DIR/skills/$skill" ".opencode/skills/$skill"
    ok "Copied $skill to .opencode/skills/"
    SKILLS_COPIED=$((SKILLS_COPIED + 1))
  fi
done
[ $SKILLS_COPIED -eq 0 ] && [ -d ".opencode/skills" ] && [ "$(ls -A .opencode/skills 2>/dev/null)" ] && true

# Agent
mkdir -p .opencode/agents
if [ -f ".opencode/agents/dgat-architect.json" ]; then
  ok "Agent already exists (.opencode/agents/dgat-architect.json)"
elif [ -f "$DGAT_OPENCODE_DIR/agents/dgat-architect.json" ]; then
  cp "$DGAT_OPENCODE_DIR/agents/dgat-architect.json" .opencode/agents/dgat-architect.json
  ok "Copied dgat-architect.json to .opencode/agents/"
else
  warn "dgat-architect.json not found in $DGAT_OPENCODE_DIR/agents/"
fi

# ── 6. Build dgat-mcp if needed ────────────────────────────────────────────
step "6. Checking dgat-mcp server"

if [ -d "$DGAT_MCP_DIR" ]; then
  cd "$DGAT_MCP_DIR"

  if [ ! -d "node_modules" ]; then
    info "Installing dgat-mcp dependencies..."
    npm install --silent 2>&1 | tail -1
    ok "Dependencies installed"
  else
    ok "dgat-mcp dependencies already installed"
  fi

  if [ ! -f "dist/index.js" ]; then
    info "Building dgat-mcp..."
    npm run build 2>&1 | tail -1
    ok "dgat-mcp built successfully"
  else
    ok "dgat-mcp already built"
  fi

  cd "$PROJECT_ROOT"
else
  warn "dgat-mcp directory not found at $DGAT_MCP_DIR"
  info "MCP server will be fetched via npx when opencode starts"
fi

# ── 7. Start dgat backend ─────────────────────────────────────────────────
step "7. Starting DGAT backend"

BACKEND_PORT="${DGAT_BACKEND_PORT:-8090}"

# Check if backend is already running
if curl -sf "http://localhost:$BACKEND_PORT/api/tree" &> /dev/null; then
  ok "DGAT backend already running on port $BACKEND_PORT"
else
  info "Starting dgat --backend on port $BACKEND_PORT..."
  $DGAT_BIN --backend --port "$BACKEND_PORT" &
  DGAT_PID=$!

  # Wait for backend to be ready
  MAX_WAIT=15
  WAITED=0
  while [ $WAITED -lt $MAX_WAIT ]; do
    if curl -sf "http://localhost:$BACKEND_PORT/api/tree" &> /dev/null; then
      ok "DGAT backend started (PID: $DGAT_PID) on port $BACKEND_PORT"
      break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
  done

  if [ $WAITED -ge $MAX_WAIT ]; then
    error "Backend did not start within ${MAX_WAIT}s"
    warn "It may still be starting — check with: curl http://localhost:$BACKEND_PORT/api/tree"
  fi
fi

# ── 8. Verify all routes ──────────────────────────────────────────────────
step "8. Verifying API routes"

ROUTES_OK=0
ROUTES_TOTAL=3

for route in /api/tree /api/dep-graph /api/blueprint; do
  if curl -sf "http://localhost:$BACKEND_PORT$route" &> /dev/null; then
    ok "$route — responding"
    ROUTES_OK=$((ROUTES_OK + 1))
  else
    warn "$route — not responding"
  fi
done

echo ""
if [ $ROUTES_OK -eq $ROUTES_TOTAL ]; then
  ok "All $ROUTES_TOTAL routes verified"
else
  warn "$ROUTES_OK/$ROUTES_TOTAL routes responding — some may need a re-scan"
fi

# ── summary ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║            Setup Complete!                ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}DGAT Backend:${NC}  http://localhost:$BACKEND_PORT"
echo -e "${CYAN}API Routes:${NC}"
echo "  GET /api/tree        — file tree"
echo "  GET /api/dep-graph   — dependency graph"
echo "  GET /api/blueprint   — architecture overview"
echo ""
echo -e "${CYAN}OpenCode Tools:${NC}"
echo "  dgat_context    — full file context with dependencies"
echo "  dgat_impact     — blast radius analysis"
echo "  dgat_search     — find files by name or description"
echo "  dgat_blueprint  — project architecture overview"
echo ""
echo -e "${CYAN}OpenCode Skills:${NC}"
echo "  dgat-analyze    — deep codebase analysis"
echo "  dgat-review     — dependency-aware code review"
echo ""
echo -e "${CYAN}OpenCode Agent:${NC}"
echo "  dgat-architect  — architecture analysis persona"
echo ""
echo -e "${BOLD}Start coding:${NC}  opencode"
echo -e "${BOLD}Re-scan:${NC}      $DGAT_BIN $PROJECT_ROOT"
echo -e "${BOLD}Stop backend:${NC}  kill %1  (or pkill -f 'dgat --backend')"
echo ""
