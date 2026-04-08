# DGAT Software Blueprint

## Project Overview
This project is a **Distributed GPU Kernel Optimization Intelligence System** designed to autonomously refine PyTorch deep learning models. It acts as an "Autonomous Research Agent" that iteratively selects, generates, benchmarks, and redacts high-performance CUDA and Triton kernels to maximize model inference speed (Fast_P score) while maintaining numerical correctness. The system leverages an AI-driven feedback loop to optimize 90+ kernel types (MatMul, Flash Attention, Softmax, etc.) across a standardized benchmark ecosystem.

## Architecture
The system operates on a distinct three-layer pipeline:

1.  **Orchestration Engine (`orchestrate.py`, `workflow.md`)**:
    *   **Secured Leaderboard**: Manages the state of the loop (Can we move to the next kernel?).
    *   **Amdahl's Law Enforcement**: Dynamically prioritizes kernels based on time vs. throughput trade-offs.
    *   **Validation**: Ensures progress measurements (e.g., throughput) meet convergence thresholds (5-plateau moves) before rewriting source files.

2.  **Core Agent Knowledge Base**:
    *   **Host Inference Cycle**: Reads instructions from `program.md`, executes a **Compile -> Benchmark -> (Keep/Revert) -> Report** loop in a single `kernel.py` file.
    *   **Keystages (Benchmarking)**:
        *   *Smoke Test*: Basic sanity check (Thread safety, syntax).
        *   *Correctness*: 5-stage testing including numerical stability, determinism, edge cases, and crash logs.
        *   *Speed*: Timing relative to PyTorch reference.
        *   *Roofline*: Estimating theoretical max performance based on hardware specs.
    *   **Fusion & Tiling Strategies**: Manages shared memory tiling for batched operations and float16 optimizations.

3.  **Execution & Optimization卫健委**:
    *   **Entrypoints**: `kernel.py` is the single entry point for the *current* bottlenecks. `profile.py` scans global bottlenecks; `prepare.py` establishes baselines.
    *   **Kernel Generation**: Standardizes fast-forward generations for MatMul, Softmax, MSMB, CUDA, and Triton variants using backend utilities (`cuda/_compile.py`).

| Component | Primary Responsibility | Key File |
| :--- | :--- | :--- |
| **Agent Host** | Runs the compile-benchmark-loop; edits `kernel.py` | `kernel.py` |
| **Agent Logger** | Maintains `results.tsv`; tracks `progress.png` trends | `analysis.py` |
| **Research Bridge** | Maps Intel's `KernelBench` problems to editable templates | `kernelbench/bridge.py` |
| **Benchmark Harness** | Verifies speedup/correctness; sources `areraw`, `fast_` metrics | `bench.py`, `bench_kb.py` |
| **Profiler** | Identifies bottlenecks; scans `kernels/` for latent optimization opportunities | `profile.py` |
| **Model Template** | Defines test utility interfaces (`models/gpt2.py` variants) | `models/gpt2.py` |
| **Export Engine** | Packages kernels/windows into `torch-ext` for HuggingFace submission | `export_hf.py` |

## Technical Details

### Localization Constraints
*   **Single Source of Truth**: All research logic for the current experiment resides in `kernel.py`.
*   **Kernel Selection**: Optimization efforts are strictly directed toward kernels listed in `model_medium.py` or `models/llama_7b.py` based on `profile.py` rankings.
*   **Safety Gates**: The agent is configured to revert changes immediately if:
    *   Correctness metrics fail the 5-stage suite.
    *   Throughput is not > 5x Y.0x Y.5.0.
    *   Memory bandwidth permits optimization are failing.
*   **Database Integration**: Optimized kernels are serialized into `db.json` or `tsv` files for consumption by downstream datasets and KBs (Triton/CUDA).

### Optimization Strategies
*   **Backend Selection**: Automatic choice between `Triton` (fast prototyping) and native `CUDA/C++` (high TFLOPS) via `torch-ext`.
*   **Tensor Core Utilization**: Utilizes WMA (WaveMention) blocks for reduced memory latency through double-buffering.
*   **Causal Masking**: Handles model-specific KV cache requirements efficiently.
*   **Fusion**: Combines fused `MLP` blocks for reduced kernel overhead.

### Execution Flow
1.  **Profile Scan**: `profile.py` identifies current bottleneck ops.
2.  **Template Creation**: `prepare.py` generates baseline PyTorch code.
3.  **Burn-in**: `orchestrate.py` runs "Smoke" tests to eliminate obvious corrupt kernels.
4.  **Iterative Optimization**: `kernel.py` edits specific bottleneck logic.
5.  **Verification**: `bench_kb.py` confirms speedup and numerical stability.
6.  **Loop Decision**: `orchestrate.py` re-assesses if the peak speedup is > 5x; otherwise, revert.

### Verification Pipeline
The system enforces **Five-Stage Verification** before allowing a kernel to enter the deployment pipeline:
1.  **Smoke**: Basic invokability.
2.  **Numerical**: Float tolerance checks (atol=1e-2).
3.  **Determinism**: Multiple runs produce identical output.
4.  **Edge Cases**: Stress testing on NaN/infinity inputs.
5.  **Roofline**: Validates observed TFLOPS against theoretical max.

### Data Output
*   **Logs**: `results.tsv` (std: kernel, time, speedup, status).
*   **State**: `models/__init__.py` registry handles model selection.
*   **Baseline**: Persistent storage in `prepare.py` allows speedup comparison against stable PyTorch versions.