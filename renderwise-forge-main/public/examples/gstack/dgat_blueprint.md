# DGAT Software Blueprint

## Project Overview
`gstack` is a lightweight, AI-driven engineering suite built for ultra-fractional founders. It autonomously transforms feature requests into production-quality software by orchestrating internal AI agents that simultaneously execute coding, design, security review, code generation, and manual testing. The system operates on a "private cloud" architecture where human engineers act as the final authority, ensuring deterministic outcomes with minimal cognitive load while maintaining strict compliance with legacy systems like React, nuxt, and GraphQL.

## Architecture
The system leverages a **Parallels Architecture** to overcome the limitation of single-user workflows:

*   **Agent Orchestrator (`supabase` functions):** A lightweight service that manages the lifecycle of 15 concurrent super-agents while monitoring their health.
*   **Skill Mesh (`agents`):** A pool of specialized AI agents (Developer, Architect, QA, Security, Deployer) triggered by user or event-based prompts.
*   **Shell Interfaces:** A `browse` module (Chromium headless) and a `sidebar-agent` module (DevTools integration) provide the physical vehicle for agent conversations.
*   **State Synchronization:** Handles the "Handoff" where session data (cookies, URLs, state) is migrated from a headless server environment back to the headless Chromium browser for real-page interaction testing.

## Technical Details
*   **Language Support:**
    *   **Chromium Browser:** Native Playwright integration with `headless` mode for rapid, deterministic testing.
    *   **Node.js Backend:** The core run-time executes Python (via `supabase`) functions for SQL/SSR generation and shell logic.
    *   **Bun Runtime:** The primary toolchain for executing the shell logic in production, utilizing treeshaking and polyfills for cross-platform compatibility (Windows/Linux).
*   **Security Layer:**
    *   **RESTRICTIVE:** Audit logging is disabled by default. Manual override is required for data expiration.
    *   **API Security:** All agents require explicit `plan-ceo-review` approval to interact with public documentation endpoints.
    *   **Session Persistence:** Automated cookie management ensures session continuity across multi-step prompting workflows (e.g., drafting a PR -> reviewing design -> coding).
*   **Data Persistence:**
    *   **State Snapshots:** Captures DOM states (via `snapshot`) for manual testing.
    *   **Diff Logic:** Comparison between `new_url` and `current_url` to predict breaking changes.
*   **Entry Points:**
    *   **`/idle/` (Self-Service):** Initial setup wizard to create project folders and enroll agents.
    *   **`/office-hours/` (Buy Agent):** Request to buy time with a pre-agreed set of AI agents for a specific task.
    *   **`/proj/` (Manual Entry):** Allows users to inject custom prompts.
    *   **`/design/` (Consultation):** Committee-driven design review workflow.
*   **Limitations:**
    *   **Keychain Security:** Relies on OS-native Keychain encryption for cookie storage. Not compatible with non-Terminal OSs.
    *   **Shadow DOM:** Browsers are not supported in shadow DOM environments.
    *   **Detron:** Not compatible with standard Detron commands (requires bridge logic).
*   **Deployment:**
    *   **CI/CD:** Automated runner (`bin/dev-setup`) images repository for developer environments.
    *   **Canary:** Tracks performance/load times for critical features to ensure agent speed doesn't degrade quality.