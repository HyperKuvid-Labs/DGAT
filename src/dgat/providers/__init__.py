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
    provider_class = PROVIDERS.get(name.lower())
    if not provider_class:
        raise ValueError(f"Unknown provider: {name}")
    return provider_class(**kwargs)


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
