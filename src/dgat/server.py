"""DGAT backend server — FastAPI.

Serves the single-page UI and exposes read-only JSON endpoints backed by
the scan artifacts on disk (file_tree.json, dep_graph.json, dgat_blueprint.md).

The C++ binary is now a scan-only producer; this module owns the HTTP surface.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse


UI_HTML_PATH = Path(__file__).parent / "ui.html"


def _load_json(path: Path) -> Optional[Any]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def _find_node_in_tree(tree: Any, rel_path: str) -> Optional[dict]:
    stack = [tree]
    while stack:
        cur = stack.pop()
        if not isinstance(cur, dict):
            continue
        if cur.get("rel_path") == rel_path:
            return cur
        stack.extend(cur.get("children", []) or [])
    return None


def create_app(data_dir: Path) -> FastAPI:
    data_dir = Path(data_dir).resolve()
    tree_path = data_dir / "file_tree.json"
    graph_path = data_dir / "dep_graph.json"
    blueprint_path = data_dir / "dgat_blueprint.md"

    app = FastAPI(title="DGAT Backend", version="2")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        if not UI_HTML_PATH.exists():
            raise HTTPException(500, f"UI missing at {UI_HTML_PATH}")
        return HTMLResponse(UI_HTML_PATH.read_text(encoding="utf-8"))

    @app.get("/api/tree")
    def api_tree() -> JSONResponse:
        data = _load_json(tree_path)
        if data is None:
            return JSONResponse(
                {"error": f"file_tree.json not found in {data_dir}. Run `dgat scan` first."},
                status_code=404,
            )
        return JSONResponse(data)

    @app.get("/api/dep-graph")
    def api_dep_graph() -> JSONResponse:
        data = _load_json(graph_path)
        if data is None:
            return JSONResponse(
                {"error": f"dep_graph.json not found in {data_dir}. Run `dgat scan` first."},
                status_code=404,
            )
        return JSONResponse(data)

    @app.get("/api/blueprint", response_class=PlainTextResponse)
    def api_blueprint() -> PlainTextResponse:
        if not blueprint_path.exists():
            return PlainTextResponse(
                "# No blueprint found\n\nRun `dgat scan` in this directory first.",
                status_code=404,
            )
        return PlainTextResponse(blueprint_path.read_text(encoding="utf-8"))

    @app.get("/api/file")
    def api_file(path: str) -> dict:
        """Description + dependency info for a single file by rel_path."""
        tree = _load_json(tree_path)
        graph = _load_json(graph_path)
        if tree is None and graph is None:
            raise HTTPException(404, "Scan data missing. Run `dgat scan` first.")

        node = None
        if graph is not None:
            node = next(
                (n for n in graph.get("nodes", []) if n.get("rel_path") == path),
                None,
            )

        tree_node = _find_node_in_tree(tree, path) if tree is not None else None

        return {
            "rel_path": path,
            "name": (tree_node or {}).get("name") or (node or {}).get("name") or path.rsplit("/", 1)[-1],
            "description": (tree_node or {}).get("description") or (node or {}).get("description"),
            "depends_on": (node or {}).get("depends_on", []),
            "depended_by": (node or {}).get("depended_by", []),
        }

    @app.get("/health")
    def health() -> dict:
        return {
            "status": "ok",
            "data_dir": str(data_dir),
            "tree": tree_path.exists(),
            "graph": graph_path.exists(),
            "blueprint": blueprint_path.exists(),
        }

    return app


def serve(data_dir: Path, port: int = 8090, host: str = "127.0.0.1") -> None:
    import uvicorn

    app = create_app(data_dir)
    uvicorn.run(app, host=host, port=port, log_level="warning")
