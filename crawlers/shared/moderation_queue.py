"""
Moderation queue helpers.

Canonical queue entry format (camelCase):
- id
- entryId
- domain
- action
- status
- candidateData
- existingData
- diff
- diffSummary
- importantChanges
- provenance { source, crawledAt, crawlerVersion, ... }
- reviewedBy
- reviewedAt
- createdAt
- updatedAt
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def _coalesce(*values: Any) -> Any:
    for value in values:
        if value is not None:
            return value
    return None


def build_queue_provenance(
    source: Optional[str],
    crawled_at: Optional[str],
    crawler_version: str,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        'source': source or '',
        'crawledAt': crawled_at or utc_now_iso(),
        'crawlerVersion': crawler_version,
    }
    if extra:
        for key, value in extra.items():
            if key not in payload and value is not None:
                payload[key] = value
    return payload


def summarize_diff(diff: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    data = diff or {}
    added = data.get('added') if isinstance(data.get('added'), dict) else {}
    modified = data.get('modified') if isinstance(data.get('modified'), dict) else {}
    removed = data.get('removed') if isinstance(data.get('removed'), dict) else {}
    unchanged = data.get('unchanged') if isinstance(data.get('unchanged'), dict) else {}
    diff_type = data.get('type') or ('update' if modified or removed else 'create')

    return {
        'type': diff_type,
        'addedCount': len(added),
        'modifiedCount': len(modified),
        'removedCount': len(removed),
        'unchangedCount': len(unchanged),
        'totalChanges': len(added) + len(modified) + len(removed),
    }


def _ensure_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def canonicalize_queue_entry(raw: Dict[str, Any], crawler_version: str = '0.1.0') -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError('Moderation queue entry must be an object')

    candidate_data = _coalesce(raw.get('candidateData'), raw.get('candidate_data'))
    existing_data = _coalesce(raw.get('existingData'), raw.get('existing_data'))
    diff = raw.get('diff') if isinstance(raw.get('diff'), dict) else {}

    provenance_raw = raw.get('provenance') if isinstance(raw.get('provenance'), dict) else {}
    source = _coalesce(
        provenance_raw.get('source'),
        raw.get('source'),
        isinstance(candidate_data, dict) and candidate_data.get('url') or None,
    )
    crawled_at = _coalesce(
        provenance_raw.get('crawledAt'),
        raw.get('createdAt'),
        raw.get('created_at'),
        raw.get('timestamp'),
    )
    queue_provenance = build_queue_provenance(
        source=source,
        crawled_at=crawled_at,
        crawler_version=_coalesce(provenance_raw.get('crawlerVersion'), crawler_version),
        extra=provenance_raw,
    )

    canonical = {
        'id': str(raw.get('id') or _coalesce(raw.get('entryId'), raw.get('entry_id')) or ''),
        'entryId': _coalesce(raw.get('entryId'), raw.get('entry_id')),
        'domain': raw.get('domain'),
        'action': raw.get('action') or 'update',
        'status': raw.get('status') or 'pending',
        'candidateData': candidate_data,
        'existingData': existing_data,
        'diff': diff,
        'diffSummary': raw.get('diffSummary') if isinstance(raw.get('diffSummary'), dict) else summarize_diff(diff),
        'importantChanges': _ensure_list(raw.get('importantChanges')),
        'provenance': queue_provenance,
        'reviewedBy': _coalesce(raw.get('reviewedBy'), raw.get('reviewed_by')),
        'reviewedAt': _coalesce(raw.get('reviewedAt'), raw.get('reviewed_at')),
        'createdAt': _coalesce(raw.get('createdAt'), raw.get('created_at'), queue_provenance.get('crawledAt')),
        'updatedAt': _coalesce(raw.get('updatedAt'), raw.get('updated_at')),
    }

    return canonical


def validate_queue_entry(entry: Dict[str, Any]) -> List[str]:
    errors: List[str] = []

    required = ['id', 'domain', 'action', 'status', 'candidateData', 'diff', 'provenance', 'createdAt']
    for key in required:
        if entry.get(key) is None:
            errors.append(f"Missing required field '{key}'")

    provenance = entry.get('provenance')
    if not isinstance(provenance, dict):
        errors.append("Field 'provenance' must be an object")
    else:
        for key in ('source', 'crawledAt', 'crawlerVersion'):
            if not provenance.get(key):
                errors.append(f"Field 'provenance.{key}' is required")

    if not isinstance(entry.get('diff'), dict):
        errors.append("Field 'diff' must be an object")

    if entry.get('status') not in {'pending', 'approved', 'rejected', 'accepted'}:
        errors.append("Field 'status' must be one of pending|approved|rejected|accepted")

    if entry.get('action') not in {'create', 'update', 'delete'}:
        errors.append("Field 'action' must be one of create|update|delete")

    return errors


def canonicalize_queue_payload(payload: Any, crawler_version: str = '0.1.0') -> List[Dict[str, Any]]:
    items: Iterable[Any]
    if isinstance(payload, dict):
        items = payload.get('queue', [])
    elif isinstance(payload, list):
        items = payload
    else:
        items = []

    result: List[Dict[str, Any]] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        item = canonicalize_queue_entry(raw, crawler_version=crawler_version)
        if not validate_queue_entry(item):
            result.append(item)
    return result
