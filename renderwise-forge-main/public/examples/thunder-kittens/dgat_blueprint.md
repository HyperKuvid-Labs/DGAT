# DGAT Software Blueprint

## Project Overview
This is a high-performance, header-only CUDA extension library (ThunderKittens) designed for NVIDIA GPU computing. It specializes in generating tile-concentric deep learning kernels, specifically optimized for LLM inference and trialing over NVIDIA's Blackwell architecture (H100, B200). The system leverages standard CUDA primitives (tensor cores), asynchronous memory transfers, and worker overlap to deliver 800+ TFLOPs throughput while serving as a bridge between low-level C++ kernels and high-level PyTorch/container integrations.

## Architecture
The project utilizes a modular, versioned distribution structure ( thunderkirren-2.0) organized as follows:

*   **Core Engine**: Located in the `.include` folder, this contains the shared logical components, mathematical operations (kernels), and primitive types (`r_t`, `s_t`, `g_t`). It serves as the dependency root for all derived implementations.
*   **Component-Based Modules**: Key libraries like **Flux**, **Layernorm**, **Gemm**, and **GroupOps** are implemented in separate `.cu` files within the `kernels` directory, managed via Makefiles. Each component is independent but follows a strict architecture pattern to ensure efficiency.
*   **Demos & Integration**: The `demos` folder contains pre-written PyTorch wrappers (TorchScript models like GPT2) that dispatch directly to specific TK kernels. This allows for rapid experimentation without recompiling the core CUDA engine.
*   **Runtime Infrastructure**: A parallel programming framework with primitives for All-Gather, All-Reduce, and Ring Attention ensures efficient data movement across multi-GPU configurations, particularly helpful for stateful training loops and gradient accumulation.

## Technical Details
*   **Hardware Targeting**: Specifically optimized for **Blackwell GPUs** (hence the "ThunderKittens" moniker, referencing Blackwell's silicon). Supports 8-bit and 4-bit quantization formats (BF16, INT8, NVFP4) to maximize alpha-bandwidth utilization.
*   **Memory Abstraction**: Employs async loads/stores and warp-level parallelism (`warpid`) to minimize system overhead and synchronization latency.
*   **Steerable Execution**: Supports custom kernel entry points (templates) allowing applications to define the exact tile size and workload pattern locally without forcing the fixed grid.
*   **Deployment**: The library includes Doxygen wrappers in `Doxyfile` to auto-generate comprehensive documentation from the C++ source.