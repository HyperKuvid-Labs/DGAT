"""DGAT data types"""

from typing import Optional
from pydantic import BaseModel, Field


class FileNode(BaseModel):
    name: str
    rel_path: str
    abs_path: str
    is_dir: Optional[bool] = None
    is_file: Optional[bool] = None
    extension: Optional[str] = None
    description: Optional[str] = None
    depends_on: list[str] = []
    depended_by: list[str] = []
    children: list["FileNode"] = []


class FileTree(BaseModel):
    root_path: Optional[str] = None
    nodes: Optional[list[FileNode]] = None
    # C++ binary format — single root node with nested children
    name: Optional[str] = None
    rel_path: Optional[str] = None
    abs_path: Optional[str] = None
    is_dir: Optional[bool] = None
    is_file: Optional[bool] = None
    extension: Optional[str] = None
    description: Optional[str] = None
    depends_on: list[str] = []
    depended_by: list[str] = []
    children: list["FileTree"] = []
    error_traces: list = []
    hash: Optional[str] = None
    version: Optional[int] = None


class DepNode(BaseModel):
    rel_path: str
    abs_path: str
    name: Optional[str] = None
    description: Optional[str] = None
    depends_on: list[str] = []
    depended_by: list[str] = []
    is_dir: Optional[bool] = None
    is_file: Optional[bool] = None


class DepEdge(BaseModel):
    from_node: str = Field(validation_alias="from")
    to_node: str = Field(validation_alias="to")
    description: Optional[str] = None


class DepGraph(BaseModel):
    nodes: list[DepNode]
    edges: list[DepEdge]


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
