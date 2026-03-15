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
from fastapi.middleware.cors import CORSMiddleware

import time
import os
from .endpoints import router
from .provider import get_provider


# Read config from environment variables
AI_PORT = int(os.environ.get("AI_PORT", 8002))
AI_HOST = os.environ.get("AI_HOST", "0.0.0.0")
provider = get_provider()

app = FastAPI()

raw_origins = os.environ.get("CORS_ORIGIN", "http://localhost:5173,http://localhost:5174")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

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
    return {
        "status": "ok",
        "provider": provider.healthcheck(),
        "host": AI_HOST,
        "port": AI_PORT,
    }


@app.get("/version")
def version():
    return {
        "service": "systemfehler-ai-sidecar",
        "version": os.environ.get("npm_package_version", "0.1.0"),
        "provider": provider.healthcheck(),
        "host": AI_HOST,
        "port": AI_PORT,
    }
