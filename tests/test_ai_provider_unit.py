import os
import socket
import unittest
from unittest.mock import patch

from backend.ai_service.provider import AIProviderError, NullProvider, OllamaProvider, get_provider


class AIProviderUnitTests(unittest.TestCase):
    def test_null_provider_reports_disabled(self):
        provider = NullProvider()
        self.assertFalse(provider.is_configured())
        health = provider.healthcheck()
        self.assertEqual(health["provider"], "none")
        self.assertEqual(health["status"], "disabled")

    def test_null_provider_raises_for_generation(self):
        provider = NullProvider()
        with self.assertRaises(AIProviderError):
            provider.generate_text(model="x", system_prompt="s", user_prompt="u")

    def test_get_provider_defaults_to_null(self):
        with patch.dict(os.environ, {}, clear=True):
            provider = get_provider()
        self.assertEqual(provider.name, "none")

    def test_ollama_timeout_becomes_provider_error(self):
        provider = OllamaProvider()

        with patch("urllib.request.urlopen", side_effect=socket.timeout("slow")):
            with self.assertRaises(AIProviderError) as exc:
                provider.generate_text(model="qwen2.5:3b", system_prompt="s", user_prompt="u")

        self.assertIn("timed out", str(exc.exception).lower())


if __name__ == "__main__":
    unittest.main()
