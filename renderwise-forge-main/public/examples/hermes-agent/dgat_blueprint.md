## Project Overview
The **Hermes Agent** is a comprehensive, multi-agent orchestration system designed for autonomous, personalized AI development. It functions as a distributed operating system, connecting to dozens of messaging platforms (Telegram, Discord, WhatsApp, Slack, etc.), local development backends (Docker, Modal), and MCP (Model Context Protocol) servers to facilitate complex agent workflows. The system features a robust CLI, seamless ACP (Agent Communication Protocol) integration, and a dynamic ecosystem of 70+ skills ranging from research and code review to creative generation and productivity optimization.

## Architecture
The system follows a modular, serverless architecture designed for flexibility and security:

- **Backend Services (`gateway`, `acceptor`, `run_agent`)**: These components act as the core orchestrator, managing session lifecycle, authentication, and route selection across multiple platforms.
- **Tool Suite (`tools/` directory)**: A modular collection of specialized tools (e.g., browser automation, decryption, code execution) thatAgents can execute directly from their terminal grid workflows.
- **Skill Ecosystem (`skills/` directory)**: Hundreds of skills are managed as dynamic packages in a `skills_hub.py`, allowing agents to select, install, and consume capabilities like GitHub auth, magic keyboard shortcuts, or AI training pipelines without requiring developer modification.
- **CLI (`cli/` directory)**: A type-safe command-line interface that abstracts underlying gateway implementations, providing secure credential injection and graceful interruption handling to plug seamlessly into IDEs or dev environments.
- **ACP Bridge (`acp_adapter/` directory)**: Manages the Agent Client Protocol, serving as the gateway between Hermes and external AI assistants or other productivity agents (e.g., Law Enforcement agents, Security specialists), ensuring secure context sharing with standardized headers.
- **Frontend (`hermes/`, `website/` directories)**: A text-based Grid UI (running in a discrete terminal) for deploying tasks alongside standard CLI inputs, coupled with built-in documentation via Docusaurus.

## Technical Details

**Language**: Python 3.11+
**Packaging**: Uses `uv` for dependency management and Nix for cross-platform isolation.

**Security Posture**:
- **Runtime Safety**: All heavy processes run within a sandboxed Docker zone or Plasma cellno environment. Hard-coded paths to home directories are explicitly disabled.
- **Data Protection**: Sensitive contexts are auto-deleted after session end (ephemeral) but can be resumable via API persistence if configured. PII is filtered based on configuration flags.
- **Authentication**: Supports API Keys, OAuth (Openrouter, Nous, GitHub), and Hardware Security Keys (Neurality).

**Key Components**:
1.  **Provider Fronts**: A `models.dev` subsystem that resolves model origins (OpenRouter, Z.ai, DashScope) and normalizes locales without vendor lock-in.
2.  **Context Engine**: A compression layer that intelligently truncates tool outputs to fit memory windows, protected by a "History" table to prevent corruption.
3.  **Session Manager**: A non-volatile database (SQLite/DB) that persists agent state (memory, tools, pricing usage) across interruptions, allowing failed requests to re-run from a checkpoint.
4.  **Command Layer (`hermes_cli`)**: A modular wrapper that decouples the TUI from the backend logic, enabling specific plugins (e.g., Electron, Swing, command-line tools) without breaking the main agent loop.

**Deployment**:
- Supports runs via `docker-compose`, `node_modules`, Systemd-based containers, or Plasma cells.
- Includes a dependency timeline for CI/CD, testing all major CLI scenarios, and Docker linting.