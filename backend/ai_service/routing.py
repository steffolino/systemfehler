"""
Model routing policy for Systemfehler AI
- Cheap default model, escalate under explicit conditions
- Provider-agnostic
"""

class ModelRouter:
    def __init__(self):
        self.default_model = "cheap-model-v1"
        self.escalation_model = "expensive-model-v2"
        self.policy = {}

    def route(self, feature, explicit_escalation=False):
        if explicit_escalation:
            return self.escalation_model
        return self.default_model
