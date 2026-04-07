"""DGAT MCP server implementation"""

import json
import sys
from pathlib import Path
from typing import Optional, Any

from dgat.scanner import (
    run_scan,
    run_update,
    load_file_tree,
    load_dep_graph,
    load_blueprint,
    get_file_description,
    get_dependencies,
    get_dependents,
    search_files,
    find_data_files,
)


class MCPError(Exception):
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def create_response(result: Any = None, error: Optional[MCPError] = None) -> dict:
    if error:
        return {
            "jsonrpc": "2.0",
            "error": {
                "code": error.code,
                "message": error.message,
            },
        }
    return {
        "jsonrpc": "2.0",
        "id": None,
        "result": result,
    }


def handle_initialize(params: dict) -> dict:
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {
            "tools": {},
        },
        "serverInfo": {
            "name": "dgat",
            "version": "1.0.0",
        },
    }


def handle_list_tools(params: dict) -> list[dict]:
    return [
        {
            "name": "scan",
            "description": "Run a full DGAT scan on a codebase to build file tree, dependency graph, and generate LLM descriptions",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to scan (default: current directory)",
                    },
                    "provider": {
                        "type": "string",
                        "description": "LLM provider (vllm, ollama, openai, anthropic, openrouter)",
                    },
                    "model": {"type": "string", "description": "Model name"},
                    "deps_only": {
                        "type": "boolean",
                        "description": "Skip LLM descriptions",
                    },
                },
                "required": [],
            },
        },
        {
            "name": "update",
            "description": "Incremental update of changed files (requires prior scan)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Path to update (default: current directory)",
                    },
                },
                "required": [],
            },
        },
        {
            "name": "describe_file",
            "description": "Get LLM-generated description for a specific file",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "rel_path": {
                        "type": "string",
                        "description": "Relative path to the file",
                    },
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": ["rel_path"],
            },
        },
        {
            "name": "get_dependencies",
            "description": "Get list of files that the given file depends on",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "rel_path": {
                        "type": "string",
                        "description": "Relative path to the file",
                    },
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": ["rel_path"],
            },
        },
        {
            "name": "get_dependents",
            "description": "Get list of files that depend on the given file",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "rel_path": {
                        "type": "string",
                        "description": "Relative path to the file",
                    },
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": ["rel_path"],
            },
        },
        {
            "name": "get_blueprint",
            "description": "Get the architectural blueprint (dgat_blueprint.md)",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": [],
            },
        },
        {
            "name": "search_files",
            "description": "Search files by name or description using fuzzy matching",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Maximum results (default: 10)",
                    },
                },
                "required": ["query"],
            },
        },
        {
            "name": "get_file_tree",
            "description": "Get the full file tree structure",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": [],
            },
        },
        {
            "name": "get_dep_graph",
            "description": "Get the dependency graph",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "scan_path": {
                        "type": "string",
                        "description": "Path where scan was performed",
                    },
                },
                "required": [],
            },
        },
    ]


def handle_tool_call(name: str, params: dict) -> Any:
    scan_path = params.pop("scan_path", None)
    path = Path(scan_path) if scan_path else None

    if name == "scan":
        result = run_scan(
            path=params.get("path", "."),
            provider=params.get("provider"),
            model=params.get("model"),
            deps_only=params.get("deps_only", False),
        )
        return result.model_dump()

    elif name == "update":
        result = run_update(path=params.get("path", "."))
        return result.model_dump()

    elif name == "describe_file":
        rel_path = params.get("rel_path")
        if not rel_path:
            raise MCPError(-32602, "Missing required parameter: rel_path")
        desc = get_file_description(rel_path, path)
        return {"rel_path": rel_path, "description": desc}

    elif name == "get_dependencies":
        rel_path = params.get("rel_path")
        if not rel_path:
            raise MCPError(-32602, "Missing required parameter: rel_path")
        deps = get_dependencies(rel_path, path)
        return {"rel_path": rel_path, "dependencies": deps}

    elif name == "get_dependents":
        rel_path = params.get("rel_path")
        if not rel_path:
            raise MCPError(-32602, "Missing required parameter: rel_path")
        dependents = get_dependents(rel_path, path)
        return {"rel_path": rel_path, "dependents": dependents}

    elif name == "get_blueprint":
        result = load_blueprint(path)
        if result:
            return {"content": result.content}
        return {"content": "", "error": "No blueprint found. Run scan first."}

    elif name == "search_files":
        query = params.get("query")
        if not query:
            raise MCPError(-32602, "Missing required parameter: query")
        limit = params.get("limit", 10)
        results = search_files(query, path, limit)
        return {"results": [r.model_dump() for r in results]}

    elif name == "get_file_tree":
        tree = load_file_tree(path)
        if tree:
            return tree.model_dump()
        return {"error": "No file tree found. Run scan first."}

    elif name == "get_dep_graph":
        graph = load_dep_graph(path)
        if graph:
            return graph.model_dump()
        return {"error": "No dependency graph found. Run scan first."}

    else:
        raise MCPError(-32601, f"Unknown tool: {name}")


def handle_request(request: dict) -> dict:
    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")

    try:
        if method == "initialize":
            result = handle_initialize(params)
            return create_response(result)

        elif method == "tools/list":
            tools = handle_list_tools(params)
            return create_response(tools)

        elif method == "tools/call":
            tool_name = params.get("name")
            tool_params = params.get("arguments", {})
            result = handle_tool_call(tool_name, tool_params)
            return create_response(result)

        else:
            raise MCPError(-32601, f"Unknown method: {method}")

    except MCPError as e:
        return create_response(error=e)
    except Exception as e:
        return create_response(error=MCPError(-32603, str(e)))


def run_stdio():
    """Run MCP server over stdio"""
    while True:
        line = sys.stdin.readline()
        if not line:
            break

        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError:
            print(
                json.dumps(create_response(error=MCPError(-32700, "Invalid JSON"))),
                flush=True,
            )
        except Exception as e:
            print(
                json.dumps(create_response(error=MCPError(-32603, str(e)))), flush=True
            )


def run_http(port: int = 3000):
    """Run MCP server over HTTP"""
    from http.server import HTTPServer, BaseHTTPRequestHandler
    import urllib.parse

    class MCPHandler(BaseHTTPRequestHandler):
        def do_POST(self):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)

            try:
                request = json.loads(body)
                response = handle_request(request)
                response_body = json.dumps(response).encode()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", len(response_body))
                self.end_headers()
                self.wfile.write(response_body)
            except Exception as e:
                self.send_response(500)
                self.end_headers()

        def do_GET(self):
            if self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status": "ok"}')
            else:
                self.send_response(404)
                self.end_headers()

        def log_message(self, format, *args):
            pass  # Suppress logging

    server = HTTPServer(("0.0.0.0", port), MCPHandler)
    print(f"MCP server running on http://0.0.0.0:{port}", file=sys.stderr)
    server.serve_forever()


def main(transport: str = "stdio", port: int = 3000):
    """Main entry point for MCP server"""
    if transport == "http":
        run_http(port)
    else:
        run_stdio()


if __name__ == "__main__":
    main()
