"""Provider base class"""

from abc import ABC, abstractmethod
from typing import Optional


class BaseProvider(ABC):
    """Abstract base class for LLM providers"""

    name: str = "base"

    def __init__(
        self,
        endpoint: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.endpoint = endpoint
        self.api_key = api_key
        self.model = model

    @abstractmethod
    def chat(self, messages: list[dict], **kwargs) -> dict:
        """Send a chat request to the provider"""
        pass

    @abstractmethod
    def chat_complete(self, prompt: str, **kwargs) -> str:
        """Complete a prompt and return the text response"""
        pass

    def is_available(self) -> bool:
        """Check if the provider is available"""
        return True
