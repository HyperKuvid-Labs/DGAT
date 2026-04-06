# 08 — Troubleshooting

Common issues and how to fix them.

## Build Failures

### `cmake: command not found`

```bash
# Ubuntu/Debian
sudo apt-get install cmake

# Arch
sudo pacman -S cmake

# macOS
brew install cmake
```

### `OpenSSL not found` or `OPENSSL_INCLUDE_DIR not found`

```bash
# Ubuntu/Debian
sudo apt-get install libssl-dev

# Arch
sudo pacman -S openssl

# macOS
brew install openssl@3
export OPENSSL_ROOT_DIR=$(brew --prefix openssl@3)
cmake -B build -DOPENSSL_ROOT_DIR=$OPENSSL_ROOT_DIR
```

### `xxhash not found`

```bash
# Ubuntu/Debian
sudo apt-get install libxxhash-dev

# Arch
sudo pacman -S xxhash

# If still not found, the build falls back to header-only mode (uses xxhash.h)
```

### `tree-sitter not found`

Tree-sitter is optional. Without it, DGAT uses regex-based import extraction (less accurate but works).

```bash
# Install tree-sitter
bash install.sh cli
```

### C++ compiler errors

Make sure you have a C++17-capable compiler:

```bash
g++ --version   # needs 11+
clang++ --version   # needs 14+
```

## LLM / vLLM Issues

### vLLM won't start

```bash
# Check GPU availability
nvidia-smi

# Check CUDA
nvcc --version

# If no GPU, use CPU mode
vllm serve Qwen/Qwen3.5-2B --device cpu
```

### `Connection refused` when DGAT talks to LLM

1. Make sure vLLM is running: `curl http://localhost:8000/v1/models`
2. Check the endpoint: `echo $DGAT_LLM_ENDPOINT`
3. Default is `http://localhost:8000/v1`

### LLM responses are slow

- Use a smaller model (Qwen3.5-2B is the fastest)
- Use GPU instead of CPU
- Reduce `--max-model-len` if memory is tight
- Consider a more powerful GPU or multi-GPU setup

## DGAT Scan Issues

### Scan hangs on a large project

DGAT sends files to the LLM sequentially. Large projects take time. You can:

1. Use a `.dgatignore` file to exclude `node_modules/`, `vendor/`, etc.
2. Use a faster LLM endpoint
3. Run `dgat update` for subsequent scans (only changed files)

### No descriptions generated

- Verify the LLM endpoint is responding: `curl http://localhost:8000/v1/chat/completions ...`
- Check that the model is loaded: `curl http://localhost:8000/v1/models`
- Look for error messages in the DGAT output

### Import extraction is inaccurate

1. Install tree-sitter grammars: `bash install.sh grammars`
2. Make sure `tree-sitter` is in your PATH: `tree-sitter --version`
3. Check that grammars are compiled: `ls grammars/*/src/parser.c`

## Frontend Issues

### `npm install` fails

```bash
# Clear cache and retry
cd renderwise-forge-main
rm -rf node_modules package-lock.json
npm install
```

### Frontend can't connect to backend

1. Make sure `dgat --backend` is running
2. Check port 8090 is accessible: `curl http://localhost:8090/api/tree`
3. Check for CORS issues in the browser console

### Blank page or UI errors

```bash
# Rebuild from scratch
cd renderwise-forge-main
rm -rf node_modules dist
npm install
npm run build
npm run dev
```

## OpenCode Integration Issues

### MCP server won't start

```bash
# Test manually
cd dgat-mcp
npm install
npm run build
node dist/index.js
```

### Tools not available in OpenCode

1. Check `opencode.jsonc` syntax (valid JSON with comments)
2. Make sure DGAT backend is running: `dgat --backend`
3. Verify the MCP server can reach the backend: `curl http://localhost:8090/api/tree`

### Agent doesn't seem to understand the codebase

1. Make sure a DGAT scan has been run on the project
2. Check that `dgat_blueprint.md` exists in the project root
3. Append the blueprint to `AGENTS.md`: `cat dgat_blueprint.md >> AGENTS.md`
4. Restart the OpenCode session

## General Tips

### Check if DGAT backend is running

```bash
curl http://localhost:8090/api/tree
```

Should return JSON. If connection refused, start it: `./build/dgat --backend`

### Check if vLLM is running

```bash
curl http://localhost:8000/v1/models
```

Should return a JSON object with model info.

### Reset DGAT state for a project

Delete the generated files and re-scan:

```bash
cd /path/to/your/project
rm -f file_tree.json dep_graph.json dgat_blueprint.md tree-sitter-config.json
./build/dgat /path/to/your/project
```

### Verbose logging

Run DGAT with more output to see what's happening:

```bash
# The C++ binary prints progress to stdout during scan
./build/dgat /path/to/project 2>&1 | tee dgat-scan.log
```
