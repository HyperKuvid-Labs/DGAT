// dgat custom tools for opencode
// calls the dgat http api directly — faster than mcp for frequent use
// place this in .opencode/tools/dgat.ts in your project

import { tool } from "@opencode-ai/plugin"

const DGAT_URL = process.env.DGAT_BACKEND_URL || "http://localhost:8090"

async function dgatGet(path: string): Promise<unknown> {
  const res = await fetch(`${DGAT_URL}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`dgat ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

async function dgatText(path: string): Promise<string> {
  const res = await fetch(`${DGAT_URL}${path}`)
  if (!res.ok) return "not available"
  return res.text()
}

// get full context for a file — description, deps, dependents, edge explanations
export const context = tool({
  description: "Use BEFORE reading any file. Get comprehensive context: what it does, what it imports, what depends on it, and blast radius. Prefer this over `read` for initial understanding.",
  args: {
    file: tool.schema.string().describe("Relative path of the file (e.g. src/auth/middleware.ts)"),
  },
  async execute({ file }) {
    try {
      const ctx = await dgatGet(`/api/context?file=${encodeURIComponent(file)}`)
      return JSON.stringify(ctx, null, 2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `error: ${msg}\n\nmake sure dgat is running: dgat --backend`
    }
  },
})

// blast radius analysis — what breaks if i change this file?
export const impact = tool({
  description: "Use BEFORE making any changes. Analyze the blast radius of changing a file — which other files would be affected, ranked by risk. Prefer this over guessing impact.",
  args: {
    file: tool.schema.string().describe("Relative path of the file to analyze"),
  },
  async execute({ file }) {
    try {
      const result = await dgatGet(`/api/impact?file=${encodeURIComponent(file)}`)
      return JSON.stringify(result, null, 2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `error: ${msg}`
    }
  },
})

// search files by name or LLM-generated description
export const search = tool({
  description: "Use INSTEAD of grep for concept-based file discovery. Search files in the codebase by name or their AI-generated description.",
  args: {
    query: tool.schema.string().describe("Search query"),
  },
  async execute({ query }) {
    try {
      const results = await dgatGet(`/api/search?q=${encodeURIComponent(query)}`)
      return JSON.stringify(results, null, 2)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `error: ${msg}`
    }
  },
})

// get the project architecture blueprint
export const blueprint = tool({
  description: "Use to get the project architecture overview — AI-generated overview of the entire codebase. Shows how components connect and depend on each other.",
  args: {},
  async execute() {
    try {
      return await dgatText("/api/blueprint")
    } catch {
      return "blueprint not available — run 'dgat <path>' to generate it"
    }
  },
})
