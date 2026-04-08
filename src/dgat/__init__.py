"""DGAT - Dependency Graph as a Tool"""

__version__ = "1.0.0"

from dgat.types import FileNode, DepNode, DepEdge, DepGraph, FileTree, ScanResult
from dgat.scanner import run_scan, run_update, search_files, search_files_llm

__all__ = [
    "__version__",
    "FileNode",
    "DepNode",
    "DepEdge",
    "DepGraph",
    "FileTree",
    "ScanResult",
    "run_scan",
    "run_update",
    "search_files",
    "search_files_llm",
]
