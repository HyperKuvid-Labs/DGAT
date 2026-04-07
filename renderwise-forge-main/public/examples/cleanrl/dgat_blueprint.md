# DGAT Software Blueprint

## Project Overview
CleanRL is a Python-centric Deep Reinforcement Learning (DRL) library that implements a vast array of on-policy and off-policy algorithms. Unlike traditional frameworks, CleanRL utilizes a universal environment wrapper to abstract diverse environments—from Atari pixel grids to continuous control physics engines—into a single standard interface. The library's single-file design philosophy allows for rapid prototyping, while its extensive benchmark suite structures allow researchers and industrial engineers to scale cloud training and performance evaluation via SLURM clusters or isolated cloud VMs.

## Architecture
The software is structured as a modular tree within the `cleanrl/` directory, divided into specialized repositories (`ppo`, `ddpg`, `td3`, `dqn`, etc.) and shared utilities. The system relies on a unified entrypoint script (`cleanrl/entrypoint.sh`) to orchestrate training workflows.

Key architectural components include:

*   **Universal Wrapper (`cleanrl_utils/atari_wrappers.py` et al.):** The core abstraction layer that handles standard Gymnasium compatibility, including environment loops (episodic vs. continuous), observation masking, and reset mechanics. This ensures consistency regardless of the underlying physical engine.
*   **Distribution Control (Categorical DQN):** The `c51.py` suite (`c51_atari.py`, `c51_atari_jax.py`, and the core `c51.py`) implements Categorical DQN (CDQN). It manages discrete continuous action spaces, adaptively distributes latent vectors across batches, and uses Group Relative Policy Optimization (GRPO) for robust training on environments like Breakout and BeamRider.
*   **Algorithm Variants:**
    *   **Single/Dual-Stage:** Vanilla PPO, TD3, SAC, and DDPG.
    *   **Continuous Action:** Extensive implementations in `ddpg_continuous_action.py`, `ppo_continuous_action.py`, and `sac_continuous_action.py`.
*   **Benchmark Engine (`benchmark/`):** A centralized orchestration layer. Scripts like `benchmark/zoo.sh`, `benchmark/ppo.sh`, and those referencing SLURM (`benchmark/cleanrl_1gpu.slurm_template`) manage parallel execution, resource allocation, and logging (WandB/TensorBoard) across workers and processes.

## Technical Details

*   **Language and Execution:**
    *   **Python 3.7+** is the standard, though experiments in certain subdirectories (e.g., `cleanrl/ppg_config.py`) utilize XLA/JAX compilers for speed.
    *   The core execution engine (`cleanrl/pyproject.toml`) enforces `uv`-based dependencies to ensure fast, virtual-environment-independent testing.
    *   GPU acceleration primarily runs PyTorch on desktop, while the `348`-file test suite supports JAX for environments requiring high-performance distributed computing (HalfCheetah, Walker2d).
*   **Environment Strategy:**
    *   **EnvPool/EnvpoolXlaJAX:** The backend utilizes a property-based actor-critic system where multiple agent instances run simultaneously but share a single update buffer. This enables massive sample efficiency and multi-TPU/multi-GPU training.
    *   **Isolation:** The `dqn_weather.py` (and similar) utilizes asynchronous environments (server/client pattern) to prevent dependency ordering in multi-task pipelines, a technique crucial for complex hardware setups.
*   **Resource Scaling:**
    *   **Multi-GPU:** Tightly coded scripts (e.g., `sac_atari.sh`) handle resource counts using `taskset` and `RANK` variables.
    *   **SLURM Support:** Templates in `benchmark/*.sh` and `benchmark/cleanrl_1gpu.slurm_template` automate node allocation, dynamic CPU-to-GPU prompting, and release management.
*   **Limitations & Notes:**
    *   **Notebook/Diagrams:** The project includes multi-panel figures (Inferred from image files) and interactive blog content that are not executable within this script-based environment.
    *   **Exclusions:** Pre-commit hooks (`pre-commit-config.yaml`) explicitly exclude sensitive external secrets and container logs from standard style checks.
    *   **Performance:** Heavy閉heng analysis (`benchmark/rnd.sh`) relies on external plotting libraries and Horizon that may introduce latency depending on network topology.