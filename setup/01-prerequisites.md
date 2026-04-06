# 01 — Prerequisites

Before doing anything, make sure your system has these tools installed.

## Required

| Tool | Minimum Version | Why |
|---|---|---|
| **GCC** | 11+ | C++17 compiler for the DGAT backend |
| **Clang** | 14+ (alternative to GCC) | C++17 compiler for the DGAT backend |
| **CMake** | 3.16+ | Build system for the C++ backend |
| **pkg-config** | any | Finds OpenSSL and xxhash during build |
| **OpenSSL** | 3.x (dev headers) | HTTPS support in cpp-httplib |
| **xxhash** | any (dev headers) | File fingerprinting |
| **Node.js** | 18+ | Frontend dev server + MCP server |
| **npm** or **bun** | npm 9+ / bun 1.0+ | Package manager for the frontend |
| **git** | any | Cloning tree-sitter grammars |
| **curl** + **gzip** | any | Downloading tree-sitter CLI |

## Optional but Recommended

| Tool | Why |
|---|---|
| **vLLM** | Local LLM server for file/edge descriptions (GPU recommended) |
| **tree-sitter CLI** | Precise import extraction (regex fallback works without it) |
| **GPU (NVIDIA)** | Faster LLM inference with vLLM |

## Check Your System

```bash
# Compiler
g++ --version        # or clang++ --version

# CMake
cmake --version

# Node.js
node --version

# pkg-config
pkg-config --version

# OpenSSL headers (should find the library)
pkg-config --libs openssl

# xxhash headers (should find the library)
pkg-config --libs libxxhash   # or: ls /usr/lib/x86_64-linux-gnu/libxxhash.so*
```

## Install System Dependencies (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  g++ \
  cmake \
  pkg-config \
  libssl-dev \
  libxxhash-dev \
  git \
  curl \
  gzip
```

## Install System Dependencies (Arch Linux)

```bash
sudo pacman -S --noconfirm \
  base-devel \
  gcc \
  cmake \
  pkg-config \
  openssl \
  xxhash \
  git \
  curl \
  gzip
```

## Install System Dependencies (Fedora/RHEL)

```bash
sudo dnf install -y \
  gcc \
  gcc-c++ \
  cmake \
  pkg-config \
  openssl-devel \
  xxhash-devel \
  git \
  curl \
  gzip
```

## Install System Dependencies (macOS)

```bash
brew install \
  cmake \
  pkg-config \
  openssl@3 \
  xxhash \
  git \
  curl
```

> **Next:** [02 — Build DGAT](02-build-dgat.md)
