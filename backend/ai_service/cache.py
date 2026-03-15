from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from collections import OrderedDict
from typing import Any


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class TTLCache:
    def __init__(self, max_entries: int = 512) -> None:
        self.max_entries = max_entries
        self._lock = threading.Lock()
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Any | None:
        now = time.time()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if expires_at <= now:
                self._store.pop(key, None)
                return None
            self._store.move_to_end(key)
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        expires_at = time.time() + max(ttl_seconds, 1)
        with self._lock:
            self._store[key] = (expires_at, value)
            self._store.move_to_end(key)
            while len(self._store) > self.max_entries:
                self._store.popitem(last=False)


CACHE_TTL_RETRIEVE = _env_int("AI_CACHE_TTL_RETRIEVE_SECONDS", 600)
CACHE_TTL_REWRITE = _env_int("AI_CACHE_TTL_REWRITE_SECONDS", 86400)
CACHE_TTL_SYNTHESIZE = _env_int("AI_CACHE_TTL_SYNTHESIZE_SECONDS", 1800)
ai_cache = TTLCache(max_entries=_env_int("AI_CACHE_MAX_ENTRIES", 512))


def normalize_query(query: str) -> str:
    return " ".join((query or "").strip().lower().split())


def cache_key(prefix: str, *parts: str) -> str:
    return "::".join([prefix, *parts])


def fingerprint_evidence(evidence: list[Any]) -> str:
    compact = []
    for item in evidence:
        if hasattr(item, "model_dump"):
            entry = item.model_dump()
        else:
            entry = dict(item)
        compact.append(
            {
                "source": entry.get("source"),
                "confidence": entry.get("confidence"),
                "content_hash": hashlib.sha256(str(entry.get("content", "")).encode("utf-8")).hexdigest(),
            }
        )
    payload = json.dumps(compact, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()
