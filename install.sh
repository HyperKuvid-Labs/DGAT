#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PREFIX="${INSTALL_PREFIX:-/usr/local}"
BUILD_DIR="${BUILD_DIR:-$SCRIPT_DIR/build}"
GRAMMARS_DIR="${GRAMMARS_DIR:-$SCRIPT_DIR/grammars}"

TS_VERSION="0.20.8"
TS_CLI_URL="https://github.com/tree-sitter/tree-sitter/releases/download/v${TS_VERSION}/tree-sitter-linux-x64.gz"
OS="$(uname -s)"

info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
error() { echo -e "\033[1;31m[ERROR]\033[0m $1"; exit 1; }

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    error "Required command '$1' not found. Please install it first."
  fi
}

install_tree_sitter_cli() {
  info "Installing tree-sitter CLI..."

  if command -v tree-sitter &> /dev/null; then
    info "tree-sitter already installed: $(tree-sitter --version 2>/dev/null || echo unknown)"
    return 0
  fi

  if [ "$OS" = "Darwin" ]; then
    if ! command -v brew &> /dev/null; then
      error "Homebrew is required on macOS. Install from https://brew.sh and rerun."
    fi
    info "Installing tree-sitter via Homebrew..."
    brew install tree-sitter
    info "tree-sitter CLI installed successfully"
    return 0
  fi

  local ts_bin="$INSTALL_PREFIX/bin/tree-sitter"
  mkdir -p "$INSTALL_PREFIX/bin"

  # Linux fallback installer
  local current_version=""
  if command -v tree-sitter &> /dev/null; then
    current_version=$(tree-sitter --version 2>/dev/null | awk '{print $2}')
  fi

  local tmp_gz="/tmp/tree-sitter.gz"
  local tmp_bin="/tmp/tree-sitter.bin"
  info "Downloading tree-sitter CLI..."
  curl -sSL "$TS_CLI_URL" -o "$tmp_gz"
  gunzip -f "$tmp_gz" -c > "$tmp_bin"
  chmod +x "$tmp_bin"

  info "Installing to $ts_bin..."
  if [ -w "$(dirname "$ts_bin")" ]; then
    install -m 0755 "$tmp_bin" "$ts_bin"
  else
    sudo install -m 0755 "$tmp_bin" "$ts_bin"
  fi

  info "tree-sitter CLI installed successfully"
}

install_tree_sitter_grammars() {
  info "Installing tree-sitter grammars..."

  check_cmd npm
  check_cmd git

  mkdir -p "$GRAMMARS_DIR"
  cd "$GRAMMARS_DIR"

  local npm_quiet_flags=(--no-fund --no-audit --loglevel=error)

  local grammars=(
    "tree-sitter-c"
    "tree-sitter-cpp"
    "tree-sitter-cuda"
    "tree-sitter-python"
    "tree-sitter-go"
    "tree-sitter-javascript"
    "tree-sitter-typescript"
    "tree-sitter-rust"
    "tree-sitter-java"
    "tree-sitter-ruby"
    "tree-sitter-php"
    "tree-sitter-bash"
    "tree-sitter-json"
    "tree-sitter-html"
    "tree-sitter-css"
    "tree-sitter-yaml"
    "tree-sitter-toml"
    "tree-sitter-sql"
    "tree-sitter-markdown"
    "tree-sitter-ipython"
  )

  for grammar in "${grammars[@]}"; do
    if [ -d "$grammar" ]; then
      info "Updating $grammar..."
      cd "$grammar"
      git pull --rebase --autostash >/dev/null 2>&1 || npm update "${npm_quiet_flags[@]}" >/dev/null 2>&1 || true
      cd "$GRAMMARS_DIR"
    else
      info "Installing $grammar..."
      if git clone "https://github.com/$grammar" >/dev/null 2>&1; then
        true
      elif npm install "${npm_quiet_flags[@]}" "$grammar" >/dev/null 2>&1; then
        true
      else
        warn "Failed to install $grammar, trying without native binding..."
        npm install "${npm_quiet_flags[@]}" --ignore-scripts "$grammar" >/dev/null 2>&1 || {
          warn "Failed to install $grammar, skipping..."
        }
      fi
    fi
  done

  info "Compiling grammars..."
  for grammar in */; do
    if [ -d "$grammar" ] && [ -f "$grammar/package.json" ]; then
      local name=$(basename "$grammar")
      cd "$grammar"
      if npx tree-sitter generate >/dev/null 2>&1; then
        info "  Compiled $name"
      else
        warn "  Skipping $name (generation failed)"
      fi
      cd "$GRAMMARS_DIR"
    fi
  done

  info "Tree-sitter grammars installed"
}

configure_tree_sitter() {
  info "Configuring tree-sitter..."

  local config_dir="${XDG_CONFIG_HOME:-$HOME/.config}/tree-sitter"
  mkdir -p "$config_dir"

  cat > "$config_dir/config.json" << EOF
{
  "parser-directories": [
    "$GRAMMARS_DIR",
    "$SCRIPT_DIR/grammars"
  ]
}
EOF

  info "Tree-sitter configured with parser directories: $GRAMMARS_DIR"
}

install_dependencies() {
  info "Installing system dependencies..."

  if command -v apt-get &> /dev/null; then
    info "Using apt-get..."
    sudo apt-get update
    sudo apt-get install -y \
      build-essential \
      pkg-config \
      libssl-dev \
      libxxhash-dev \
      git \
      curl \
      gzip
  elif command -v yum &> /dev/null; then
    info "Using yum..."
    sudo yum install -y \
      gcc \
      gcc-c++ \
      make \
      pkg-config \
      openssl-devel \
      git \
      curl \
      gzip
  elif command -v pacman &> /dev/null; then
    info "Using pacman..."
    sudo pacman -S --noconfirm \
      base-devel \
      pkg-config \
      openssl \
      git \
      curl \
      gzip
  elif command -v brew &> /dev/null; then
    info "Using Homebrew..."
    brew install \
      openssl@3 \
      pkg-config \
      cmake \
      node \
      tree
  else
    warn "Package manager not detected. Please install manually:"
    warn "  - GCC/Clang compiler"
    warn "  - pkg-config"
    warn "  - OpenSSL development headers"
    warn "  - git, curl, gzip"
  fi
}

build_dgat() {
  info "Building DGAT..."

  mkdir -p "$BUILD_DIR"
  cd "$BUILD_DIR"

  info "Running cmake..."
  cmake .. \
    -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGRAMMARS_DIR="$GRAMMARS_DIR"

  info "Compiling..."
  local jobs=4
  if command -v nproc &> /dev/null; then
    jobs=$(nproc)
  elif [ "$OS" = "Darwin" ]; then
    jobs=$(sysctl -n hw.ncpu)
  fi
  make -j"$jobs"

  info "DGAT built successfully"
}

install_dgat() {
  info "Installing DGAT..."

  cd "$BUILD_DIR"

  local install_target="$INSTALL_PREFIX/bin"
  if [ -w "$install_target" ] || [ -w "$INSTALL_PREFIX" ]; then
    make install
  else
    info "Using sudo for installation to $INSTALL_PREFIX"
    sudo make install
  fi

  info "DGAT installed to $INSTALL_PREFIX"
}

usage() {
  cat << EOF
DGAT Installation Script

Usage: $0 [OPTIONS] [COMMAND]

Commands:
  all         Full installation (default)
  deps        Install system dependencies only
  cli         Install tree-sitter CLI only
  grammars    Install tree-sitter grammars only
  configure   Configure tree-sitter only
  build       Build DGAT only
  install     Install DGAT only

Options:
  --prefix=PREFIX    Installation prefix (default: /usr/local)
  --grammars=DIR     Grammars directory (default: \$PWD/grammars)
  --no-tree-sitter   Skip tree-sitter installation
  --help             Show this help message

Examples:
  $0                           # Full installation
  $0 --prefix=/home/user/.local  # Custom prefix
  $0 cli grammars configure     # Install and configure tree-sitter only
  $0 build                     # Build only (after deps installed)

Environment Variables:
  INSTALL_PREFIX    Installation prefix
  BUILD_DIR         Build directory
  GRAMMARS_DIR      Tree-sitter grammars directory

EOF
}

main() {
  local do_deps=true
  local do_cli=true
  local do_grammars=true
  local do_configure=true
  local do_build=true
  local do_install=true

  for arg in "$@"; do
    case $arg in
      --prefix=*)
        INSTALL_PREFIX="${arg#*=}"
        ;;
      --grammars=*)
        GRAMMARS_DIR="${arg#*=}"
        ;;
      --no-tree-sitter)
        do_cli=false
        do_grammars=false
        do_configure=false
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      deps)
        install_dependencies
        exit 0
        ;;
      cli)
        install_tree_sitter_cli
        exit 0
        ;;
      grammars)
        install_tree_sitter_grammars
        exit 0
        ;;
      configure)
        configure_tree_sitter
        exit 0
        ;;
      build)
        build_dgat
        exit 0
        ;;
      install)
        do_deps=false
        do_cli=false
        do_grammars=false
        do_configure=false
        do_build=false
        ;;
      all|"")
        ;;
      *)
        error "Unknown option: $arg"
        ;;
    esac
  done

  info "DGAT Installation"
  info "Install prefix: $INSTALL_PREFIX"
  info "Grammars dir: $GRAMMARS_DIR"
  echo

  if $do_deps; then
    install_dependencies
    echo
  fi

  if $do_cli; then
    install_tree_sitter_cli
    echo
  fi

  if $do_grammars; then
    install_tree_sitter_grammars
    echo
  fi

  if $do_configure; then
    configure_tree_sitter
    echo
  fi

  if $do_build; then
    build_dgat
    echo
  fi

  if $do_install; then
    install_dgat
  fi

  echo
  info "Installation complete!"
  info "Run 'dgat' to get started."
}

main "$@"
