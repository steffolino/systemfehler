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
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import time
import os
from pathlib import Path
from collections import defaultdict, deque
from .endpoints import router
from .provider import get_provider
from .turnstile import is_turnstile_configured, verify_turnstile_token

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env", override=True)

# Read config from environment variables
AI_PORT = int(os.environ.get("AI_PORT", 8002))
AI_HOST = os.environ.get("AI_HOST", "0.0.0.0")
provider = get_provider()
RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("AI_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_REQUESTS = int(os.environ.get("AI_RATE_LIMIT_MAX_REQUESTS", "30"))
RATE_LIMIT_BUCKETS = defaultdict(deque)

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
    if request.method == "POST" and request.url.path in {"/rewrite", "/retrieve", "/synthesize", "/enrich"}:
        if request.url.path in {"/rewrite", "/retrieve", "/synthesize"} and is_turnstile_configured():
            token = request.headers.get("x-turnstile-token")
            verification = verify_turnstile_token(
                token,
                request.client.host if request.client else None,
            )
            if not verification.get("success"):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "turnstile_verification_failed",
                        "message": "Bot protection verification failed.",
                        "errorCodes": verification.get("error_codes", []),
                    },
                )

        client_ip = request.client.host if request.client else "unknown"
        bucket = RATE_LIMIT_BUCKETS[(client_ip, request.url.path)]
        now = time.time()
        while bucket and (now - bucket[0]) > RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "rate_limited",
                    "message": "Too many AI requests. Please wait and try again.",
                },
            )
        bucket.append(now)

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
        "turnstile": {
            "configured": is_turnstile_configured(),
            "siteKey": (os.environ.get("TURNSTILE_SITE_KEY", "") or "").strip() or None,
        },
        "host": AI_HOST,
        "port": AI_PORT,
    }


@app.get("/version")
def version():
    return {
        "service": "systemfehler-ai-sidecar",
        "version": os.environ.get("npm_package_version", "0.1.0"),
        "provider": provider.healthcheck(),
        "turnstile": {
            "configured": is_turnstile_configured(),
            "siteKey": (os.environ.get("TURNSTILE_SITE_KEY", "") or "").strip() or None,
        },
        "host": AI_HOST,
        "port": AI_PORT,
    }
