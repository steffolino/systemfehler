"""
Systemfehler AI Backend LLM Gateway
- Handles model routing, query rewriting, answer synthesis, enrichment suggestions

Run with:
    uvicorn backend.ai_service.gateway:app --reload

Endpoints:
    /rewrite (POST)
    /synthesize (POST)
    /enrich (POST)
    /health (GET)
"""
from fastapi import FastAPI, Request
from pydantic import BaseModel

import time
import os
from .endpoints import router
from .routing import ModelRouter
from .telemetry import log_telemetry


# Read config from environment variables
AI_PORT = int(os.environ.get("AI_PORT", 8002))
AI_HOST = os.environ.get("AI_HOST", "0.0.0.0")

app = FastAPI()
app.include_router(router)

class Telemetry(BaseModel):
    feature: str
    model: str
    latency_ms: int
    success: bool
    token_estimate: int
    cost_estimate: float

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    latency = int((time.time() - start) * 1000)
    # TODO: log feature, model, latency, success, token/cost estimates
    return response

# Allow running directly: python backend/ai_service/gateway.py
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8010))
    uvicorn.run("backend.ai_service.gateway:app", host="0.0.0.0", port=port, reload=True)

# Placeholder endpoints
@app.get("/health")
def health():
    return {"status": "ok"}
