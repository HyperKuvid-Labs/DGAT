"""DGAT scanner - wraps the C++ binary"""

import os
import json
import subprocess
from pathlib import Path
from typing import Optional

from dgat.config import load_config, get_provider_config
from dgat.types import FileTree, DepGraph, ScanResult, BlueprintResult, SearchResult


def get_binary_path() -> Path:
    """Get path to the DGAT binary"""
    # Check if bundled with package
    package_bin = Path(__file__).parent / "bin" / "dgat"
    if package_bin.exists():
        return package_bin

    # Check in PATH
    import shutil

    path_bin = shutil.which("dgat")
    if path_bin:
        return Path(path_bin)

    # Check ~/.local/bin
    local_bin = Path.home() / ".local" / "bin" / "dgat"
    if local_bin.exists():
        return local_bin

    # Try to get from installer (downloads if needed)
    try:
        from dgat._installer import get_binary_path as download_binary

        return download_binary()
    except Exception:
        pass

    raise FileNotFoundError("DGAT binary not found. Please install or build DGAT.")


def get_data_dir() -> Path:
    """Get the data directory where scan outputs are stored"""
    return Path.cwd()


def find_data_files(
    path: Path = Path.cwd(),
) -> tuple[Optional[Path], Optional[Path], Optional[Path]]:
    """Find the data files in a scan directory"""
    tree_file = path / "file_tree.json"
    dep_file = path / "dep_graph.json"
    blueprint_file = path / "dgat_blueprint.md"

    return (
        tree_file if tree_file.exists() else None,
        dep_file if dep_file.exists() else None,
        blueprint_file if blueprint_file.exists() else None,
    )


def run_scan(
    path: str,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    deps_only: bool = False,
    port: int = 8090,
) -> ScanResult:
    """Run a DGAT scan on the given path"""
    binary = get_binary_path()

    cmd = [str(binary), path]

    if provider:
        cmd.extend([f"--provider={provider}"])
    if model:
        cmd.extend([f"--model={model}"])
    if deps_only:
        cmd.append("--deps-only")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
        )

        if result.returncode == 0:
            # Parse output for stats
            files_scanned = 0
            edges = 0
            for line in result.stdout.split("\n"):
                if "file tree built" in line.lower():
                    files_scanned = 1  # We don't have exact count easily
                if "dependency graph built" in line.lower():
                    # Try to extract numbers
                    parts = line.split(":")
                    if len(parts) > 1:
                        stats = parts[1].strip()
                        # Parse "X nodes, Y edges"
                        for part in stats.split(","):
                            if "node" in part.lower():
                                try:
                                    files_scanned = int(part.strip().split()[0])
                                except:
                                    pass
                            if "edge" in part.lower():
                                try:
                                    edges = int(part.strip().split()[0])
                                except:
                                    pass

            return ScanResult(
                success=True,
                path=path,
                files_scanned=files_scanned,
                edges=edges,
                message="Scan completed successfully",
            )
        else:
            return ScanResult(
                success=False,
                path=path,
                files_scanned=0,
                edges=0,
                message=result.stderr or "Scan failed",
            )
    except subprocess.TimeoutExpired:
        return ScanResult(
            success=False,
            path=path,
            files_scanned=0,
            edges=0,
            message="Scan timed out",
        )
    except Exception as e:
        return ScanResult(
            success=False,
            path=path,
            files_scanned=0,
            edges=0,
            message=str(e),
        )


def run_update(path: str) -> ScanResult:
    """Run an incremental update"""
    binary = get_binary_path()

    cmd = [str(binary), "update", path]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        return ScanResult(
            success=result.returncode == 0,
            path=path,
            files_scanned=0,
            edges=0,
            message="Update completed" if result.returncode == 0 else result.stderr,
        )
    except Exception as e:
        return ScanResult(
            success=False,
            path=path,
            files_scanned=0,
            edges=0,
            message=str(e),
        )


def load_file_tree(path: Path = None) -> Optional[FileTree]:
    """Load file tree from JSON"""
    if path is None:
        tree_file, _, _ = find_data_files()
    else:
        tree_file, _, _ = find_data_files(path)

    if tree_file is None:
        return None

    with open(tree_file) as f:
        data = json.load(f)

    return FileTree(**data)


def load_dep_graph(path: Path = None) -> Optional[DepGraph]:
    """Load dependency graph from JSON"""
    if path is None:
        _, dep_file, _ = find_data_files()
    else:
        _, dep_file, _ = find_data_files(path)

    if dep_file is None:
        return None

    with open(dep_file) as f:
        data = json.load(f)

    return DepGraph(**data)


def load_blueprint(path: Path = None) -> Optional[BlueprintResult]:
    """Load blueprint markdown"""
    if path is None:
        _, _, blueprint_file = find_data_files()
    else:
        _, _, blueprint_file = find_data_files(path)

    if blueprint_file is None:
        return None

    with open(blueprint_file) as f:
        content = f.read()

    return BlueprintResult(success=True, content=content)


def get_file_description(rel_path: str, path: Path = None) -> Optional[str]:
    """Get description for a specific file"""
    tree = load_file_tree(path)
    if tree is None:
        return None

    def find_node(node):
        if hasattr(node, "rel_path") and node.rel_path == rel_path:
            return node
        if hasattr(node, "children") and node.children:
            for child in node.children:
                found = find_node(child)
                if found:
                    return found
        return None

    node = find_node(tree)
    return node.description if node else None


def get_dependencies(rel_path: str, path: Path = None) -> list[str]:
    """Get files that the given file depends on"""
    graph = load_dep_graph(path)
    if graph is None:
        return []

    for node in graph.nodes:
        if node.rel_path == rel_path:
            return node.depends_on

    return []


def get_dependents(rel_path: str, path: Path = None) -> list[str]:
    """Get files that depend on the given file"""
    graph = load_dep_graph(path)
    if graph is None:
        return []

    for node in graph.nodes:
        if node.rel_path == rel_path:
            return node.depended_by

    return []


def search_files(query: str, path: Path = None, limit: int = 10) -> list[SearchResult]:
    """Search files by name or description"""
    tree = load_file_tree(path)
    if tree is None:
        return []

    query_lower = query.lower()
    results = []

    def search_nodes(node):
        if hasattr(node, "name") and hasattr(node, "rel_path"):
            name_lower = node.name.lower()
            desc = node.description or ""
            desc_lower = desc.lower()

            score = 0.0
            if query_lower == name_lower:
                score = 100.0
            elif query_lower in name_lower:
                score = 50.0 + (len(query_lower) / len(name_lower)) * 50
            elif query_lower in desc_lower:
                score = 25.0

            if score > 0:
                results.append(
                    SearchResult(
                        rel_path=node.rel_path,
                        name=node.name,
                        description=node.description,
                        score=score,
                    )
                )

        if hasattr(node, "children") and node.children:
            for child in node.children:
                search_nodes(child)

    search_nodes(tree)

    results.sort(key=lambda x: x.score, reverse=True)
    return results[:limit]


def search_files_llm(
    query: str,
    path: Path = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
    limit: int = 10,
) -> list[SearchResult]:
    """Search files using LLM based on name or description"""
    from dgat.providers import get_provider

    tree = load_file_tree(path)
    if tree is None:
        return []

    file_list = []

    def collect_nodes(node):
        if hasattr(node, "name") and hasattr(node, "rel_path"):
            file_list.append(
                {
                    "name": node.name,
                    "rel_path": node.rel_path,
                    "description": node.description or "",
                }
            )
        if hasattr(node, "children") and node.children:
            for child in node.children:
                collect_nodes(child)

    collect_nodes(tree)

    files_context = "\n".join(
        f"- {f['name']}: {f['description']}" if f["description"] else f"- {f['name']}"
        for f in file_list
    )

    prompt = f"""Given the following files and their descriptions:

{files_context}

Find the most relevant files for this query: "{query}"

Return only the file names (one per line) that are most relevant to the query. If none are relevant, return "NONE"."""

    try:
        llm_provider = get_provider(provider or "vllm", model=model)
        response = llm_provider.chat_complete(prompt)

        if not response or response.strip() == "NONE":
            return []

        relevant_names = [
            line.strip().lstrip("- ").strip()
            for line in response.strip().split("\n")
            if line.strip()
        ]

        results = []
        for f in file_list:
            if f["name"] in relevant_names:
                results.append(
                    SearchResult(
                        rel_path=f["rel_path"],
                        name=f["name"],
                        description=f["description"],
                        score=100.0,
                    )
                )

        return results[:limit]

    except Exception as e:
        return []
