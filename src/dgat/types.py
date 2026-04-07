"""DGAT data types"""

from typing import Optional
from pydantic import BaseModel


class FileNode(BaseModel):
    name: str
    rel_path: str
    abs_path: str
    is_dir: bool
    extension: Optional[str] = None
    description: Optional[str] = None
    depends_on: list[str] = []
    depended_by: list[str] = []
    children: list["FileNode"] = []


class DepNode(BaseModel):
    rel_path: str
    abs_path: str
    description: Optional[str] = None
    depends_on: list[str] = []
    depended_by: list[str] = []


class DepEdge(BaseModel):
    from_node: str
    to_node: str
    description: Optional[str] = None


class DepGraph(BaseModel):
    nodes: list[DepNode]
    edges: list[DepEdge]


class FileTree(BaseModel):
    root_path: str
    nodes: list[FileNode]


class ScanResult(BaseModel):
    success: bool
    path: str
    files_scanned: int
    edges: int
    message: str = ""


class BlueprintResult(BaseModel):
    success: bool
    content: str = ""
    message: str = ""


class SearchResult(BaseModel):
    rel_path: str
    name: str
    description: Optional[str] = None
    score: float = 0.0
