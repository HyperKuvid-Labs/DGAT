"""Ollama provider"""

import requests
from typing import Optional

from dgat.providers.base import BaseProvider


class OllamaProvider(BaseProvider):
    """Ollama local models provider"""

    name = "ollama"

    def __init__(
        self,
        endpoint: str = "http://localhost:11434",
        api_key: Optional[str] = None,
        model: str = "llama3",
    ):
        super().__init__(endpoint, api_key, model)
        self.endpoint = endpoint.rstrip("/")
        if not self.model:
            self.model = "llama3"

    def chat(self, messages: list[dict], **kwargs) -> dict:
        url = f"{self.endpoint}/api/chat"

        payload = {
            "model": self.model,
            "messages": messages,
            **kwargs,
        }

        response = requests.post(url, json=payload, timeout=120)
        response.raise_for_status()
        return response.json()

    def chat_complete(self, prompt: str, **kwargs) -> str:
        messages = [{"role": "user", "content": prompt}]
        response = self.chat(messages, **kwargs)

        return response.get("message", {}).get("content", "")

    def is_available(self) -> bool:
        try:
            response = requests.get(f"{self.endpoint}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
