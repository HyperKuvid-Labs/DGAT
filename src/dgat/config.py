"""DGAT configuration management"""

import os
import json
from pathlib import Path
from typing import Optional
from pydantic import BaseModel


class ProviderConfig(BaseModel):
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None


class DGATConfig(BaseModel):
    default_provider: str = "vllm"
    providers: dict[str, ProviderConfig] = {}


DEFAULT_CONFIG = DGATConfig(
    default_provider="vllm",
    providers={
        "vllm": ProviderConfig(endpoint="http://localhost:8000"),
        "ollama": ProviderConfig(endpoint="http://localhost:11434"),
        "openai": ProviderConfig(endpoint="https://api.openai.com/v1"),
        "anthropic": ProviderConfig(),
        "openrouter": ProviderConfig(endpoint="https://openrouter.ai/api"),
    },
)


def get_config_dir() -> Path:
    config_dir = Path.home() / ".dgat"
    config_dir.mkdir(exist_ok=True)
    return config_dir


def get_config_path() -> Path:
    return get_config_dir() / "config.json"


def load_config() -> DGATConfig:
    config_path = get_config_path()
    if config_path.exists():
        try:
            with open(config_path) as f:
                data = json.load(f)
            return DGATConfig(**data)
        except Exception:
            pass
    return DEFAULT_CONFIG


def save_config(config: DGATConfig) -> None:
    config_path = get_config_path()
    with open(config_path, "w") as f:
        f.write(config.model_dump_json(indent=2))


def get_provider_config(name: str) -> ProviderConfig:
    config = load_config()
    return config.providers.get(name, ProviderConfig())
