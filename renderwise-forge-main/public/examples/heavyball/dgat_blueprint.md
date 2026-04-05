# DGAT Software Blueprint

## Project Overview
HeavyBall is a high-performance PyTorch optimizer library designed for state-of-the-art training workloads. It replaces standard optimizers with specialized, composable building blocks (e.g., Laplacian momentum, SOAP) fused with Triton kernels. The library supports advanced algebraic methods (Nash, Newton-Schulz), memory-efficient ECC storage, and distributed training (DDP/FSDP).

## Architecture
The project is organized into distinct architectural layers:

1.  **Core Library (`heavyball/`)**
    *   **`__init__.py`**: Exposes a chainable `BaseOpt` API that wraps PyTorch optimizers and provides 17+ specialized building blocks.
    *   **`chainable.py`**: The primary execution engine managing graph compiles, Triton kernels, and backward-safe state initialization.
    *   **`utils.py`**: Fuses update logic intoompiled kernels and reduces memory usage through specialized matrix operations.
    *   **`helpers.py`**: Provides samplers and backends for Bayesian optimization and implicit gradients.

2.  **Examples (`examples/`)**
    *   Demonstrates dynamic chain manipulation, distributed training, mixed-precision training (BF16/functionality), and autoencoders.
    *   Includes utilities for modifying optimizer states at runtime.

3.  **Benchmarks (`benchmarks/`)**
    *   **`bench_optimizer_step.py`**: Validates optimized step latencies.
    *   **`bench_singular_values.py`**: Tests accuracy of `max`/`min` SVD implementations against DYNAMO.

4.  **Benchmarks (`test/`)**
    *   A comprehensive suite for regression testing.
    *   Includes specialized tests for BF16/quantization, CUDA/CPU consistency, and loop safety.

5.  **CI/CD (`.github/`, `scripts/`, `docs/`)**
    *   **Workflows**: Automates image builds, pipeline runs, GPU job execution, and PyPI releases.
    *   **Documentations**: Structured guides on efficiency landscapes, heavyball history (1.0/2.0/3.0), and benchmark diagnostics.

6.  **Build Tools**
    *   `build.sh`: Handles `pip install` and `twine` for PyPI distribution.
    *   `build-ci-image.yaml`: Manages PyTorch/gpytorch Docker image builds for local testing.
    *   `.gitignore`: Excludes build artifacts, caches, and environment files from version control.

## Technical Details

*   **Language & Backends**: Pure Python backend with PEP 519-compatible interfaces fused into C++ via Triton. Supports PyTorch 2.x.
*   **Performance Optimization**:
    *   **Fused Kernels**: Optimizer logic is compiled into single Triton graphs.
    *   **Memory Efficiency**: Utilizes internal ECC mechanisms and flattened parameter storage to minimize SHM regions.
*   **Accuracy Mechanisms**:
    *   **ECC**: Implements bit-level error correction to detect numerical anomalies silently.
    *   **SAGSGD Support**: Native support for structured Aggregated Stochastic Gradient SGA/Grand SGA implementations.
    *   **MARS**: Handles Multi-Step Adaptation Rate scaling for efficient multi-process training.
*   **Architecture Constraints**:
    *   Relying on `torch.compile(fullgraph=True)` for graph safety and interleaving.
    *   Strict enforcement of `front-walled` semantics (compute before any parameter update) to prevent latent states from leaking into learning pipelines.
    *   Requires explicit `orig_shapes` handling for distributed parameter shape verification.
*   **Versioning Strategy**:
    *   **2.x**: Focus on stability and simplified surgery (e.g., removing `Foreach*` prefixes).
    *   **3.x**: Renaming of `Branch` to `Parallel`, removal of `Adaptive`/`Stochastic Schedule` legacy kwargs, and migration of optimizer states to the new layout.