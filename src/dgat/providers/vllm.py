"""vLLM provider"""

import requests
from typing import Optional

from dgat.providers.base import BaseProvider


class VLLMProvider(BaseProvider):
    """vLLM provider (OpenAI-compatible API)"""

    name = "vllm"

    def __init__(
        self,
        endpoint: str = "http://localhost:8000",
        api_key: Optional[str] = None,
        model: str = "Qwen/Qwen3.5-2B",
    ):
        super().__init__(endpoint, api_key, model)
        self.endpoint = endpoint.rstrip("/")
        if not self.model:
            self.model = "Qwen/Qwen3.5-2B"

    def chat(self, messages: list[dict], **kwargs) -> dict:
        url = f"{self.endpoint}/v1/chat/completions"

        payload = {
            "model": self.model,
            "messages": messages,
            **kwargs,
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

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
        try:
            response = requests.get(f"{self.endpoint}/v1/models", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
