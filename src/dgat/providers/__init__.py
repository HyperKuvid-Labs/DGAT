"""DGAT LLM providers"""

from dgat.providers.base import BaseProvider
from dgat.providers.vllm import VLLMProvider
from dgat.providers.openai import OpenAIProvider
from dgat.providers.anthropic import AnthropicProvider
from dgat.providers.ollama import OllamaProvider
from dgat.providers.openrouter import OpenRouterProvider


PROVIDERS = {
    "vllm": VLLMProvider,
    "openai": OpenAIProvider,
    "anthropic": AnthropicProvider,
    "ollama": OllamaProvider,
    "openrouter": OpenRouterProvider,
}


def get_provider(name: str, **kwargs) -> BaseProvider:
    """Get a provider instance by name"""
    from dgat.config import load_config, get_provider_config

    provider_class = PROVIDERS.get(name.lower())
    if not provider_class:
        raise ValueError(f"Unknown provider: {name}")

    # Load config for this provider
    config = get_provider_config(name)

    # Merge config with any kwargs provided
    provider_kwargs = {}
    if config.endpoint:
        provider_kwargs["endpoint"] = config.endpoint
    if config.api_key:
        provider_kwargs["api_key"] = config.api_key
    if config.model:
        provider_kwargs["model"] = config.model
    provider_kwargs.update(kwargs)

    return provider_class(**provider_kwargs)


__all__ = [
    "BaseProvider",
    "VLLMProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "OllamaProvider",
    "OpenRouterProvider",
    "PROVIDERS",
    "get_provider",
]
