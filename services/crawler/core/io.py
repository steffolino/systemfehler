# services/crawler/core/io.py
import json, os
from typing import Iterable, Dict, Any

def save_json(path: str, data: Iterable[Dict[str, Any]]):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(list(data), f, indent=2, ensure_ascii=False)
