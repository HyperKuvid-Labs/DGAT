# DGAT Software Blueprint

## Project Overview
This project is a comprehensive Rust-based autonomous software development harness designed to mimic the functionality of the `claw` AI agent. Unlike typical CLI tools, it operates as a native extension for the Rust runtime, featuring a sophisticated "OMA" (Organic Autonomy Machine) architecture. Built to bridge human directives and high-level agent coordination, it enables the creation and management of independent agent actions without traditional pair programming constraints.

## Architecture
The system is structured into three primary autonomous mechanisms that work in harmony:

1.  **OmX (Omni-Execution Wrapper):**
    *   **Responsibilities:** Serves as the local orchestrator that converts intuitive human workflows into structured Rust code and unit-tests.
    *   **Function:** Converts natural language directives into executable commands, retrieves and verifies unit test suites, and processes git interactions locally before dispatching to higher-level agents.

2.  **clawhip (Human Cascade Agent):**
    *   **Responsibilities:** The event notification and routing layer.
    *   **Function:** Watches for external signals such as git log changes (commits), issue updates, and active agent lifecycle events. It converts these external signals into decisions outside of the coding context, effectively managing the bridge between human input and the working agent.

3.  **OmO (One Main Coordination):**
    *   **Responsibilities:** The central hub for inter-agent management.
    *   **Function:** Manages the handoffs, resolves contradictions, and ensures convergence of individual agents toward a unified plan. It is responsible for the convergence and management of the overall execution flow.

**Execution Flow:**
1.  **Human Direction:** A user or external event triggers a command.
2.  **OmX:** Parses the intent, deduplicates the prompt, creates/aggregates unit tests, and briefly executes quick iterations.
3.  **clawhip:** Analyzes the git state and policy to determine the next logical action or period of inactivity.
4.  **OmO:** Reviews decisions from OmX and clawship, decides if a higher-level agent is required, and coordinates the collective effort.

## Technical Details

*   **Language:** Rust (r11) local cloning of the `claw` CLI agent.
*   **Runtime Stack:** Tokio-based async handlers for API abstraction and SSE streaming.
*   **Data Persistence:**
    *   Session logs stored in `.claw/sessions/` using JSONL format.
    *   Golden files stored in `docs/container.md` and `PARITY.md` for reference during runtime behavior validation.
*   **Configuration Management:**
    *   Environment variables for API keys (e.g., `ANTHROPIC_API_KEY`, `XAI_API_KEY`).
    *   Proxy configuration (HTTP/HTTPS) passed via `NO_PROXY` and `HTTP_PROXY`/`HTTPS_PROXY`.
*   **Security & Quotas:**
    *   Rate limiting and hard-coded token limits for content blocks to prevent abuse.
    *   Strict type enforcement to ensure interaction layers remain typed-safe.
*   **Limits:**
    *   The system preflight checks for context window limits (e.g., max token count) before executing network requests to prevent failures.
    *   All agent actions are limited to standard Rust concurrency and timeout parameters.