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
from .endpoints import router
from .routing import ModelRouter
from .telemetry import log_telemetry


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

# Placeholder endpoints
@app.get("/health")
def health():
    return {"status": "ok"}
