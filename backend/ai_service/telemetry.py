"""
Telemetry and safety fallbacks
- Log all requests with feature, model, latency, success/failure, token/cost estimates
- Explicit weak evidence handling
"""
def log_telemetry(feature, model, latency_ms, success, token_estimate, cost_estimate):
    # TODO: implement logging to file/db
    pass

def handle_weak_evidence():
    return {"status": "weak_evidence", "message": "Evidence is missing or weak. No guessing."}
