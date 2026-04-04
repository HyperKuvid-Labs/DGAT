# DGAT Software Blueprint

## Project Overview
**Turb oQuant** is a high-performance inference engine designed to mitigate bandwidth bottlenecks during LLM generation. It implements advanced, on-device 3-bit quantum-inspired compression algorithms (specifically QJL) to compress KV cache. By utilizing compressed representation during generation and dual-sided lossless decoding, the system achieves high throughput on NVIDIA Blackwell GPUs with minimal wall-clock latency.

## Architecture
The system follows a streamlined, single-pass architecture that directly links on-chip decomposition to on-chip scoring:

1.  **Decompression Engine (`turboquant_cutile/`)**: Executes asynchronously on the GPU. It takes uncompressed KV cache vectors, applies a custom 3-bit QJL-aware quantization scheme with gradient reversal mirroring (GRM), and outputs compressed bitmaps while calculating residuals.
2.  **On-Chip Cache-layer `turboquant_cutile/collective`**: Manages memory tiering (BNU/BOB като) and parallelizes the decoding of the compressed streams for live model generation.
3.  **Kernel Layer (`turboquant_cutile/kernels.py`)**: Defines specialized CUDA kernels for memory mapping (Key/Value split) and fused attention computation (Flow Shuffle to minimize HBM traffic).
4.  **Decoder and Inference (`turboquant_cutile/host.py`)**: Aggregates decodes, sorts candidates into the processing mask using RoTP, and feeds the final logits to the model.
5.  **Visualization Dashboard (`docs/` & `website/`)**: Contains interactive HTML evidence, video previews of the pipeline steps, and static analysis reports (histograms, charts, video logs).

## Technical Details
*   **Quantization**: Utilizes **QJL** (Quantized Johnson-Lindenstrauss) to preserve locality and distribution without SPDZ-like quadratic blending, reducing memory footprint while maintaining score fidelity. Residuals are handled with a custom gradient recovery mechanism.
*   **Memory Layout**: Implements a split buffer strategy (Key/Value) to explicitly separate data paths, minimizing collision checks required for fused kernels.
*   **Hardware Optimization**: Leverages **Flow Shuffle** for efficient key-space rearrangement and Niays/Biased EXP2 for hardware acceleration of activation functions. Pipelines are designed to overlap memory access and decoding.
*   **Limitations**: Currently focused on single-B200 scale. Scalability to wider systems requires careful attention to concurrency and random rotation overhead.
*   **Evidence**: The project includes extensive visual documentation via PNGs and videos showing the raw, compressed, and reconstructed data at every stage of the pipeline.