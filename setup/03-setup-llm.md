# 03 — Setup LLM (vLLM)

DGAT uses a local LLM to generate natural-language descriptions for every file and every import relationship. It talks to any **OpenAI-compatible HTTP endpoint**.

## Recommended: vLLM with Qwen3.5-2B

Qwen3.5-2B is small, fast, and produces good quality descriptions. It runs on a single GPU with 8GB+ VRAM.

### Install vLLM

```bash
pip install vllm
```

### Start the Server

```bash
vllm serve Qwen/Qwen3.5-2B \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 4096
```

The server will be available at `http://localhost:8000/v1`.

### Verify It's Running

```bash
curl http://localhost:8000/v1/models
```

You should see a JSON response with the model name.

## Alternative Models

| Model | VRAM | Speed | Quality |
|---|---|---|---|
| **Qwen/Qwen3.5-2B** | ~4 GB | Fast | Good (recommended) |
| **Qwen/Qwen2.5-3B** | ~6 GB | Fast | Good |
| **Qwen/Qwen2.5-7B** | ~14 GB | Medium | Better |
| **meta-llama/Llama-3.2-3B** | ~6 GB | Fast | Good |
| **microsoft/Phi-3-mini-4k** | ~7 GB | Medium | Good |

```bash
# Example with a different model
vllm serve Qwen/Qwen2.5-7B --host 0.0.0.0 --port 8000
```

## No GPU? Use CPU Mode

vLLM can run on CPU (much slower, but works):

```bash
vllm serve Qwen/Qwen3.5-2B \
  --host 0.0.0.0 \
  --port 8000 \
  --device cpu
```

## Alternative: Any OpenAI-Compatible Endpoint

DGAT works with **any** server that implements the OpenAI chat completions API:

| Provider | Setup |
|---|---|
| **Ollama** | `ollama run qwen2.5:3b` (runs on `http://localhost:11434/v1`) |
| **LM Studio** | Start local server in the UI |
| **OpenRouter** | Use their OpenAI-compatible endpoint |
| **OpenAI API** | Set `OPENAI_API_KEY` and use `api.openai.com` |

## Configure DGAT to Use Your LLM

DGAT expects the LLM endpoint at `http://localhost:8000/v1` by default. If your server runs elsewhere, set the environment variable:

```bash
# Default (no config needed if using vLLM on port 8000)
export DGAT_LLM_ENDPOINT=http://localhost:8000/v1

# Using Ollama
export DGAT_LLM_ENDPOINT=http://localhost:11434/v1

# Using OpenAI directly
export DGAT_LLM_ENDPOINT=https://api.openai.com/v1
export OPENAI_API_KEY=sk-...
```

## Test the LLM Connection

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-2B",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 20
  }'
```

You should get a JSON response with a completion.

> **Next:** [04 — Setup Frontend](04-setup-frontend.md)
