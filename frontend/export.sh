#!/usr/bin/env bash
# Export the DGAT frontend as a self-contained HTML file.
# Usage: bash export.sh --name dgat-self
#
# Builds dist-export/index.html with vite-plugin-singlefile, then
# copies it to docs/examples/<name>/app.html ready for the examples
# wrapper page.

set -euo pipefail

NAME=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --name) NAME="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$NAME" ]]; then
  echo "Error: --name <id> is required"
  echo "Usage: bash export.sh --name dgat-self"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="$SCRIPT_DIR/../docs/examples/$NAME"
DEST="$DEST_DIR/app.html"

echo "→ Building export..."
cd "$SCRIPT_DIR"
bun run build:export

mkdir -p "$DEST_DIR"
cp dist-export/index.html "$DEST"

echo "✓ Exported to docs/examples/$NAME/app.html"
echo ""
echo "Next steps:"
echo "  1. Inject data:  ./build/dgat --export $DEST"
echo "  2. Add entry to docs/examples/config.json with id: \"$NAME\""
