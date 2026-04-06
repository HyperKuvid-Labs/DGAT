// dgat-mcp — mcp server for dgat
// gives ai coding agents deep codebase understanding
// supports stdio (default) and http transports
// auto-starts dgat --backend if not already running

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import { DgatClient } from "./client.js";
import { registerTools } from "./tools.js";

let backendProcess: ReturnType<typeof spawn> | null = null;

// try to reach the dgat backend, return true if healthy
async function checkBackend(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/tree`); // Changed from /health to /api/tree
    return res.ok;
  } catch {
    return false;
  }
}

// start dgat --backend as a child process, wait until healthy
async function startBackend(port: number): Promise<boolean> {
  const url = `http://localhost:${port}`;

  // quick check — maybe it's already running
  if (await checkBackend(url)) return true;

  console.error(`[dgat-mcp] starting dgat --backend on port ${port}...`);

  return new Promise((resolve) => {
    backendProcess = spawn("dgat", ["--backend", "--port", String(port)], {
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    backendProcess.stdout?.on("data", (data) => {
      console.error(`[dgat-backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr?.on("data", (data) => {
      console.error(`[dgat-backend] ${data.toString().trim()}`);
    });

    backendProcess.on("error", (err) => {
      console.error(`[dgat-mcp] failed to start dgat --backend: ${err.message}`);
      console.error(`[dgat-mcp] make sure dgat is installed and in your PATH`);
      resolve(false);
    });

    // poll until healthy (max 15s)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (await checkBackend(url)) {
        clearInterval(poll);
        console.error(`[dgat-mcp] dgat backend ready at ${url}`);
        resolve(true);
        return;
      }
      if (attempts >= 30) {
        clearInterval(poll);
        console.error(`[dgat-mcp] dgat backend did not become healthy within 15s`);
        resolve(false);
      }
    }, 500);
  });
}

// cleanup: kill backend process on exit
function cleanup() {
  if (backendProcess) {
    console.error("[dgat-mcp] stopping dgat backend...");
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
}

export async function main() {
  const transport = process.env.DGAT_MCP_TRANSPORT || "stdio";
  const dgatUrl = process.env.DGAT_BACKEND_URL || "http://localhost:8090";
  const port = parseInt(new URL(dgatUrl).port || "8090", 10);

  const server = new McpServer(
    { name: "dgat", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // auto-start backend if not reachable
  const backendReady = await checkBackend(dgatUrl) || await startBackend(port);

  if (!backendReady) {
    console.error(`[dgat-mcp] warning: dgat backend not available — tools will return errors`);
  }

  // kill backend on exit
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });
  process.on("SIGTERM", () => { cleanup(); process.exit(0); });

  const client = new DgatClient(dgatUrl);

  registerTools(server, client);

  if (transport === "http") {
    console.error("[dgat-mcp] http transport not yet implemented — use stdio mode for now");
    process.exit(1);
  }

  // stdio mode — for cli agents that spawn this process
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  console.error("[dgat-mcp] ready (stdio)");
}

// run if executed directly
if (process.argv[1]?.endsWith("dgat-mcp") || process.argv[1]?.endsWith("index.js") || process.argv[1]?.endsWith("index.ts")) {
  main().catch((err) => {
    console.error("dgat-mcp fatal error:", err.message);
    process.exit(1);
  });
}