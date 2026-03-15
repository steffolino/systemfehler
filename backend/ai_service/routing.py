"""
Model routing policy for Systemfehler AI
- Cheap default model, escalate under explicit conditions
- Provider-agnostic
"""

import os

class ModelRouter:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "none").strip().lower()
        self.default_model = os.getenv("AI_DEFAULT_MODEL", self._provider_default_model())
        self.escalation_model = os.getenv("AI_ESCALATION_MODEL", self.default_model)
        self.feature_models = {
            "rewrite": os.getenv("AI_MODEL_REWRITE", self.default_model),
            "synthesize": os.getenv("AI_MODEL_SYNTHESIZE", self.escalation_model),
            "enrich": os.getenv("AI_MODEL_ENRICH", self.default_model),
        }
        self.policy = {}

    def _provider_default_model(self):
        if self.provider == "ollama":
            return "llama3.1:8b"
        if self.provider == "openai":
            return "gpt-4o-mini"
        return "disabled"

    def route(self, feature, explicit_escalation=False):
        if explicit_escalation:
            return self.escalation_model
        return self.feature_models.get(feature, self.default_model)
