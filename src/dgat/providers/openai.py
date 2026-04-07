"""OpenAI-compatible provider"""

import os
import requests
from typing import Optional

from dgat.providers.base import BaseProvider


class OpenAIProvider(BaseProvider):
    """OpenAI-compatible provider (works with OpenAI, Azure, local servers)"""

    name = "openai"

    def __init__(
        self,
        endpoint: str = "https://api.openai.com/v1",
        api_key: Optional[str] = None,
        model: str = "gpt-4o",
    ):
        super().__init__(endpoint, api_key, model)
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.model:
            self.model = "gpt-4o"

    def chat(self, messages: list[dict], **kwargs) -> dict:
        url = f"{self.endpoint}/chat/completions"

        payload = {
            "model": self.model,
            "messages": messages,
            **kwargs,
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        response = requests.post(url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        return response.json()

    def chat_complete(self, prompt: str, **kwargs) -> str:
        messages = [{"role": "user", "content": prompt}]
        response = self.chat(messages, **kwargs)

        choices = response.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "")
        return ""

    def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            response = requests.get(
                f"{self.endpoint}/models",
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=5,
            )
            return response.status_code == 200
        except Exception:
            return False
