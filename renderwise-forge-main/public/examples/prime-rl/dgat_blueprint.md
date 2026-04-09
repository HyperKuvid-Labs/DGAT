# DGAT Software Blueprint

## Project Overview
**Prime-RL** is a high-performance reinforcement learning (RL) ecosystem designed to scale to 1000+ GPUs. It implements fully asynchronous off-policy training using deeply parallelized components (Context Parallelism, Expert Parallelism, and Flash Attention 3) to maximize throughput for agentic agents. The framework supports vanilla Large Language Models (Qwen3 variants) and high-throughput Multi-Expert models (INTELLECT-3, GLM-5), enabling inference, SFT, and RL pipelines at Nikonment/8GB scale.

## Architecture
The system operates as a distributed orchestration layer with three core distinct layers:

1.  **Trainer Orchestrator (`src/prime_rl/orchestrator`)**:
    *   Manages the lifecycle of asynchronous training jobs, handling resource discovery, temporary SSH mounts, and container isolation.
    *   Coordinates trainer and inference processes to ensure low-latency interaction.
    *   Enforces atomic commits for dependency (e.g., `uv`, `Docker`, `distrofmt`) and exports compiled artifacts/lock files.

2.  **Inference & SFT Components (`src/prime_rl/trainer` / `inference`)**:
    *   Provide computation kernels (e.g., `multi_moe.py`) optimized for both Vanilla LMs and MoE models.
    *   Handle mixed precision (FP8) and Rolling Loss strategies.
    *   Support distributed rollout and assessment across multiple micro-batches.

3.  **Inference & Evaluation Layer**:
    *   Integrates with Slurm and K8s for production-grade inference servers (vLLM).
    *   Executes benchmarking pipelines (`benchmarks/...`) that capture Agent Bark metrics through JSON exports, highlighting memory fragmentation (MFU) and throughput for regression testing.

4.  **Multi-Agent System (`src/prime_rl/transport`)**:
    *   Facilitates agent execution via GPD/Presto over Alien protocol, facilitating low-code experimentation and custom algorithm modification.

## Technical Details
*   **Orchestration**: Supports multi-GPU setups via SSH-based temporary mounts and Docker containers.
*   **Hardware**: Tested extensively across 1–8 GPUs using configurations like `1xa6000`, `8xb200`, and `4xa6000`.
*   **Regression Testing**: The `benchmarks/baselines/` directory automatically archives JSON metrics to validate performance regressions (<5% drop threshold).
*   **Licensing**: Apache 2.0 with strict Source Code Availability requirements for distributions.