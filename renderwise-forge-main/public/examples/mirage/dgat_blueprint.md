# DGAT Software Blueprint

## Project Overview
The **Mirage** project is a high-performance persistent kernel compiler designed to fuse Large Language Model (LLM) inference operations into multi-GPU microkernels. It leverages **C++**, **Python**, and **Cython** to traverse and transform complex graph structures for optimization. The core innovation involves the **NVIDIA Machine Learning Persistent Kernel (NMPK)**, which creates a "migrart" on-the-fly microkernel from scratch optimized for memory coalescing, higher inter-core bank traffic, and improved latency control on next-generation GPUs like Blackwell and Hopper.

## Architecture
The compiler follows a modular, tree-like architecture mapping from high-level Python operations (`GraphDataset`) to low-level memory interleaving and tensor execution.

1.  **Core Compiler Engine**:
    *   **Transpiler Module**: The central component (`src/transpiler/`) which reads high-level Python `GraphDataset` definitions, resolves symbolic operations, and generates low-level CUDA/Blas kernels.
    *   **Layout Engine**: Handles layout resolution and tensor shape matrices, ensuring data movement efficiency across multi-GPU dies.
    *   **Search Core**: Implements symbolic graph search to find optimized execution strategies for operations like Attention, LoRA, and Mixture of Experts (MoE).

2.  **Persistent Kernel Engine (MPK)**:
    *   **Compiler Pipeline**: Accepts raw, non-optimized LLM code, instructs the compiler to fuse matmuls, RMSNorms, and Attention layers, and exports Lindgren's-style optimized kernel sequences.
    *   **Graph Optimizer**: Automatically selects operators (from the `trendset` library) and fuses them to reduce fan-out overhead and memory access conflicts.

3.  **Python Interface (Mirage)**:
    *   Wraps the MPIK operation, providing a seamless API for `Profile`, `Trace`, and `Execute` phases.
    *   Generates Python `triton.benchmarks` automatically for iteration-triggered profiling (e.g., `norm_transformer.py`, `qknorm_gqa.py`).

4.  **Benchmarks & Dashboards**:
    *   **Benchmark Suite**: Includes specific suites for `end-to-end`, `gated_mlp`, `groups_query_attention`, and `loras`.
    *   **Docs**: Comprehensive Python-based visualizers (`pytorch`, `triton` transpilers) and RST documentation.

## Technical Details
*   **Language Stack**:
    *   **C++**: Runtime kernel, memory management, and transpilation infrastructure.
    *   **Python**: High-level API, benchmark execution, and visualization.
    *   **Cython**: Specific C++ abstraction layers (e.g., `threadblock`, `kernel`).
    *   **Embedded C**: Low-level kernel code (e.g., `rmvnorm.cu`, `reduction.cu`), optimized for специфичностях C/C++ GPU targets (Blackwell/Hopper).

*   **Key Architectural Constraints**:
    *   **No Data Races**: Strictly adheres to memory ordering guarantees to prevent instruction reordering and race conditions in concurrent kernels.
    *   **Memory Layout Safety**: Strict enforcement of `dtype` and `layout` constraints (e.g., requiring specific matrix row/column strides).
    *   **Archive Format**: Prevents accidental modification of `saved_mugraphs` JSON artifacts during builds to ensure reproducibility.
    *   **Deployment Gate**: CI pipeline runs `test_verify.py` and specific C++/Python integration tests before pushing to PyPI.

*   **History**:
    *   Nsight Compute (Niku) integration was dropped by the `MPK` team to prioritize predictive tracing and declarative execution patterns.
    *   The project shifted towards a "Serverless" architecture where kernels execute per-request without maintaining persistent memory layouts for 10s+.

*   **Bugs & Issues**:
    *   `save καθηчанный.sh` scripts are ignored by `.gitignore`.
    *   Some transpilation failures in `triton_transpiler` module may result from unsupported tensor lifecycle states.