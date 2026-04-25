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
    default_provider="openrouter",
    providers={
        "openrouter": ProviderConfig(
            endpoint="https://openrouter.ai/api/v1",
            model="google/gemini-flash-lite-preview",
        ),
        "vllm": ProviderConfig(
            endpoint="http://localhost:8000",
            model="Qwen/Qwen3-2B",
        ),
        "ollama": ProviderConfig(endpoint="http://localhost:11434"),
        "openai": ProviderConfig(endpoint="https://api.openai.com/v1"),
        "anthropic": ProviderConfig(),
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
            # merge saved config on top of defaults so providers not yet
            # touched by the user still have their default model/endpoint
            merged = DEFAULT_CONFIG.model_copy(deep=True)
            if "default_provider" in data:
                merged.default_provider = data["default_provider"]
            for name, vals in data.get("providers", {}).items():
                if name in merged.providers:
                    saved = ProviderConfig(**vals)
                    existing = merged.providers[name]
                    merged.providers[name] = ProviderConfig(
                        endpoint=saved.endpoint or existing.endpoint,
                        api_key=saved.api_key or existing.api_key,
                        model=saved.model or existing.model,
                    )
                else:
                    merged.providers[name] = ProviderConfig(**vals)
            return merged
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


def configure(
    default_provider: Optional[str] = None,
    providers: Optional[dict[str, ProviderConfig]] = None,
) -> DGATConfig:
    """Configure DGAT programmatically"""
    config = load_config()

    if default_provider:
        config.default_provider = default_provider

    if providers:
        for name, provider_config in providers.items():
            if isinstance(provider_config, dict):
                config.providers[name] = ProviderConfig(**provider_config)
            else:
                config.providers[name] = provider_config

    save_config(config)
    return config
