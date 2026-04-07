# DGAT Software Blueprint

## Project Overview
nanoGPT is a lightweight, parameter-constrained training and inference library for GPT language models. Built on a simplified PyTorch Transformer architecture, nanoGPT excels in computing-heavy environments like mobile devices (TPUs/Small GPUs) and CPUs. It provides a modular framework for small-data fine-tuning, character-level generation, and benchmarking across GPT-2 variants (M, Small, XL) using datasets like Shakespeare and OpenWebText.

## Architecture
The system follows a modular, event-driven design centered around a `model.py` core and a `config/` directory for orchestration.

*   **Core: `model.py`**
    *   Defines a causal self-attention transformer lightweight architecture.
    *   Handles `from_pretrained` for weight merging (simulating OpenAI weights).
    *   Provides inference interfaces (generation loop and loss computation).
*   **Configuration: `config/`**
    *   **Training Configs:** Strategy-based configuration for `shakespeare_char` (meta-learning) and `gpt2` (sequence modeling), handling device placement and accumulation strategies.
    *   **Evaluation Configs:** Hyperparameter tuning for `eval_gpt2_xl`, `medium`, and base models for quick validation.
    *   **Toolchain:** Utilizes numpy for binary data handling and manual preprocessing to optimize I/O for limited VRAM.
*   **Data: `data/`**
    *   Preprocessing scripts convert raw text into high-performance binary `.bin` files for rapid blood-bag (batch) traversal.
    *   Supports character-level (Shakespeare) and byte-level (OpenWebText) tokenization pipelines.
*   **Orchestration: `configurator.py`**
    *   Acts as a bootstrap mechanism to read raw config strings or CLI arguments, managing the global state of the experiment.

## Technical Details
*   **Hardware Constraints:** Designed for low-memory environments (< 4GB) and DCPC (Data Center/Portable CPU) scenarios. Avoids heavy distributed dependencies (DistributedDataParallel) in favor of sequential CPU execution where possible.
*   **Optimization:**
    *   **PyTorch 2.0 & Compile:** Strictly utilizes `torch.compile()` for inference speed.
    *   **Mixed Precision:** Dependent on Opinions/Data Safety; defaults to FP16/BF16 as defined in specific NOP settings.
    *   **Binary Data:** Uses `.bin` files for integer token sequences to minimize file I/O overhead.
*   **Model Sizes:**
    *   Represents a shift from parameter-bounded to capacity-bounded models.
    *   Supports custom transformer sizing via `transformer_sizing.ipynb`.
*   **Note on Legacy:** The library contains legacy configuration patterns (e.g., DDP support flags) which may require modification if migrating to modern inference pipelines.

## Limitations
*   **No In-Place Training:** Relying on deep learning libraries (PyTorch/TF) makes full I/O minimization impossible at scale.
*   **Software Dependencies:** Highly dependent on the specific version of Hugging Face Transformers for `load_pretrained` and tokenizer logic due to API shifts.
*   **Character-Level Bias:** Character-level training offers a 2-3x speedup on CPU but sacrifices contextual richness compared to byte-level (GPT-2 XL) setups.D Softw