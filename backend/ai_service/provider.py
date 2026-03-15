"""
Provider adapters for the Systemfehler AI sidecar.

The gateway stays runnable without an LLM backend, but useful AI features only
become available when a provider is configured.
"""

from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class AIProviderError(RuntimeError):
    """Raised when a configured provider cannot satisfy a request."""


class BaseProvider:
    name = "none"

    def is_configured(self) -> bool:
        return True

    def healthcheck(self) -> Dict[str, Any]:
        return {"provider": self.name, "configured": self.is_configured()}

    def generate_text(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int | None = None,
    ) -> Dict[str, Any]:
        raise AIProviderError("No AI provider configured")


class NullProvider(BaseProvider):
    name = "none"

    def is_configured(self) -> bool:
        return False

    def healthcheck(self) -> Dict[str, Any]:
        return {
            "provider": self.name,
            "configured": False,
            "status": "disabled",
        }


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self) -> None:
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        body = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise AIProviderError(f"Ollama HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError(f"Ollama unreachable at {self.base_url}") from exc
        except (TimeoutError, socket.timeout) as exc:
            raise AIProviderError("Ollama request timed out") from exc

    def healthcheck(self) -> Dict[str, Any]:
        request = urllib.request.Request(f"{self.base_url}/api/tags", method="GET")
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                payload = json.loads(response.read().decode("utf-8"))
                models = payload.get("models", []) if isinstance(payload, dict) else []
                return {
                    "provider": self.name,
                    "configured": True,
                    "status": "ok",
                    "models": [model.get("name") for model in models if isinstance(model, dict)],
                }
        except Exception as exc:
            return {
                "provider": self.name,
                "configured": True,
                "status": "unreachable",
                "error": str(exc),
            }

    def generate_text(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int | None = None,
    ) -> Dict[str, Any]:
        options: Dict[str, Any] = {"temperature": temperature}
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": options,
        }
        response = self._post("/api/chat", payload)
        message = response.get("message", {}) if isinstance(response, dict) else {}
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError("Ollama returned no message content")
        prompt_tokens = response.get("prompt_eval_count")
        completion_tokens = response.get("eval_count")
        return {
            "text": content.strip(),
            "usage": {
                "prompt_tokens": int(prompt_tokens or 0),
                "completion_tokens": int(completion_tokens or 0),
                "total_tokens": int(prompt_tokens or 0) + int(completion_tokens or 0),
            },
        }


class OpenAIProvider(BaseProvider):
    name = "openai"

    def __init__(self) -> None:
        self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
        self.api_key = os.getenv("OPENAI_API_KEY", "")

    def is_configured(self) -> bool:
        return bool(self.api_key)

    def _request(self, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.api_key:
            raise AIProviderError("OPENAI_API_KEY is not configured")
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            f"{self.base_url}{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}",
            },
            method="GET" if payload is None else "POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise AIProviderError(f"OpenAI HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError("OpenAI API is unreachable") from exc
        except (TimeoutError, socket.timeout) as exc:
            raise AIProviderError("OpenAI request timed out") from exc

    def healthcheck(self) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "provider": self.name,
                "configured": False,
                "status": "disabled",
            }
        try:
            self._request("/models")
            return {
                "provider": self.name,
                "configured": True,
                "status": "ok",
            }
        except AIProviderError as exc:
            return {
                "provider": self.name,
                "configured": True,
                "status": "unreachable",
                "error": str(exc),
            }

    def generate_text(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.1,
        max_tokens: int | None = None,
    ) -> Dict[str, Any]:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
        response = self._request("/chat/completions", payload)
        choices = response.get("choices", []) if isinstance(response, dict) else []
        if not choices:
            raise AIProviderError("OpenAI returned no choices")
        message = choices[0].get("message", {}) if isinstance(choices[0], dict) else {}
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError("OpenAI returned no message content")
        usage = response.get("usage", {}) if isinstance(response, dict) else {}
        return {
            "text": content.strip(),
            "usage": {
                "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
                "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
                "total_tokens": int(usage.get("total_tokens", 0) or 0),
            },
        }


def get_provider() -> BaseProvider:
    provider_name = os.getenv("AI_PROVIDER", "none").strip().lower()
    if provider_name == "ollama":
        return OllamaProvider()
    if provider_name == "openai":
        return OpenAIProvider()
    return NullProvider()
