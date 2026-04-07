"""Anthropic provider"""

import os
import requests
from typing import Optional

from dgat.providers.base import BaseProvider


class AnthropicProvider(BaseProvider):
    """Anthropic Claude API provider"""

    name = "anthropic"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "claude-sonnet-4-20250514",
    ):
        super().__init__(endpoint=None, api_key=api_key, model=model)
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.model:
            self.model = "claude-sonnet-4-20250514"

    def chat(self, messages: list[dict], **kwargs) -> dict:
        url = "https://api.anthropic.com/v1/messages"

        system = None
        for msg in messages:
            if msg.get("role") == "system":
                system = msg.get("content")
                break

        user_messages = [msg for msg in messages if msg.get("role") != "system"]

        payload = {
            "model": self.model,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "messages": user_messages,
        }

        if system:
            payload["system"] = system

        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }

        response = requests.post(url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        return response.json()

    def chat_complete(self, prompt: str, **kwargs) -> str:
        messages = [{"role": "user", "content": prompt}]
        response = self.chat(messages, **kwargs)

        content = response.get("content", [])
        if content and isinstance(content, list):
            for block in content:
                if block.get("type") == "text":
                    return block.get("text", "")
        return ""

    def is_available(self) -> bool:
        if not self.api_key:
            return False
        return True  # No good way to check without making a request
