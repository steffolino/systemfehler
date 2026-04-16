"""
Embed RAG chunks and upsert into Qdrant.

Collection: rag_systemfehler (one collection for all document tiers)

Env vars:
  OLLAMA_BASE_URL      default: http://localhost:11434
  OLLAMA_EMBED_MODEL   default: nomic-embed-text
  QDRANT_URL           default: http://localhost:6333

Usage (via CLI):
  python -m crawlers.rag.cli index
  python -m crawlers.rag.cli index --source-id ba_merkblatt_alg1 --force
"""

from __future__ import annotations

import hashlib
import os
import time
from typing import Any

import requests
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchAny,
    MatchValue,
    PointStruct,
    VectorParams,
)

from .schemas import RagChunk

COLLECTION_NAME = "rag_systemfehler"


class OllamaEmbedder:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
    ) -> None:
        self.base_url = (
            base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        ).rstrip("/")
        self.model = model or os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma:latest")

    def embed(self, text: str) -> list[float]:
        return self.embed_batch([text])[0]

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        cleaned = [t.replace("\x00", " ").strip()[:8000] or "empty" for t in texts]
        last_error: Exception | None = None
        for attempt in range(1, 4):
            try:
                resp = requests.post(
                    f"{self.base_url}/api/embed",
                    json={"model": self.model, "input": cleaned},
                    timeout=120,
                )
                resp.raise_for_status()
                vecs = resp.json().get("embeddings", [])
                if not vecs or not isinstance(vecs[0], list):
                    raise RuntimeError("Empty embedding vector returned")
                return [[float(v) for v in vec] for vec in vecs]
            except Exception as exc:
                last_error = exc
                if attempt < 3:
                    time.sleep(0.8 * attempt)
        raise RuntimeError(f"Embedding failed after retries: {last_error}") from last_error

    def healthcheck(self) -> bool:
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False


class RagIndexer:
    def __init__(
        self,
        qdrant_url: str | None = None,
        embedder: OllamaEmbedder | None = None,
    ) -> None:
        url = qdrant_url or os.getenv("QDRANT_URL", "http://localhost:6333")
        self.qdrant = QdrantClient(url=url)
        self.embedder = embedder or OllamaEmbedder()

    def ensure_collection(self) -> None:
        existing = {c.name for c in self.qdrant.get_collections().collections}
        if COLLECTION_NAME in existing:
            return
        vector_size = len(self.embedder.embed("bootstrap"))
        self.qdrant.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
        print(f"Created Qdrant collection '{COLLECTION_NAME}' (dim={vector_size})")

    def _chunk_to_point(self, chunk: RagChunk) -> PointStruct:
        vector = self.embedder.embed(chunk.text)
        # Deterministic integer ID from chunk_id
        hash_val = hashlib.sha1(chunk.chunk_id.encode()).hexdigest()[:16]
        point_id = int(hash_val, 16)
        payload: dict[str, Any] = {
            "chunk_id": chunk.chunk_id,
            "document_id": chunk.document_id,
            "source_id": chunk.source_id,
            "title": chunk.title,
            "section_title": chunk.section_title,
            "url": chunk.url,
            "source_name": chunk.source_name,
            "source_trust_level": chunk.source_trust_level,
            "document_type": chunk.document_type,
            "knowledge_layer": chunk.knowledge_layer,
            "language": chunk.language,
            "jurisdiction": chunk.jurisdiction,
            "topics": chunk.topics,
            "target_groups": chunk.target_groups,
            "publication_date": chunk.publication_date,
            "license_or_rights": chunk.license_or_rights,
            "text": chunk.text,
            "char_start": chunk.char_start,
            "char_end": chunk.char_end,
            "chunk_index": chunk.chunk_index,
            "total_chunks": chunk.total_chunks,
            "source_weight": chunk.source_weight,
        }
        return PointStruct(id=point_id, vector=vector, payload=payload)

    def index_chunks(self, chunks: list[RagChunk], batch_size: int = 32) -> int:
        self.ensure_collection()
        indexed = 0
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            try:
                vectors = self.embedder.embed_batch([c.text for c in batch])
            except Exception as exc:
                print(f"  Embed batch failed: {exc}")
                continue
            points: list[PointStruct] = []
            for chunk, vector in zip(batch, vectors):
                try:
                    hash_val = hashlib.sha1(chunk.chunk_id.encode()).hexdigest()[:16]
                    point_id = int(hash_val, 16)
                    payload: dict[str, Any] = {
                        "chunk_id": chunk.chunk_id,
                        "document_id": chunk.document_id,
                        "source_id": chunk.source_id,
                        "title": chunk.title,
                        "section_title": chunk.section_title,
                        "url": chunk.url,
                        "source_name": chunk.source_name,
                        "source_trust_level": chunk.source_trust_level,
                        "document_type": chunk.document_type,
                        "knowledge_layer": chunk.knowledge_layer,
                        "language": chunk.language,
                        "jurisdiction": chunk.jurisdiction,
                        "topics": chunk.topics,
                        "target_groups": chunk.target_groups,
                        "publication_date": chunk.publication_date,
                        "license_or_rights": chunk.license_or_rights,
                        "text": chunk.text,
                        "char_start": chunk.char_start,
                        "char_end": chunk.char_end,
                        "chunk_index": chunk.chunk_index,
                        "total_chunks": chunk.total_chunks,
                        "source_weight": chunk.source_weight,
                    }
                    points.append(PointStruct(id=point_id, vector=vector, payload=payload))
                except Exception as exc:
                    print(f"  Skip {chunk.chunk_id}: {exc}")
            if points:
                self._upsert(points)
                indexed += len(points)
        return indexed

    def _upsert(self, points: list[PointStruct]) -> None:
        for attempt in range(1, 5):
            try:
                self.qdrant.upsert(
                    collection_name=COLLECTION_NAME, points=points, wait=True
                )
                return
            except Exception as exc:
                if attempt >= 4:
                    raise
                time.sleep(1.2 * attempt)

    def search(
        self,
        query: str,
        limit: int = 8,
        knowledge_layers: list[str] | None = None,
        topics: list[str] | None = None,
        min_trust_level: str | None = None,
    ) -> list[dict[str, Any]]:
        """Semantic search over the RAG collection."""
        query_vector = self.embedder.embed(query)

        must: list[Any] = []
        if knowledge_layers:
            must.append(
                FieldCondition(key="knowledge_layer", match=MatchAny(any=knowledge_layers))
            )
        if topics:
            must.append(FieldCondition(key="topics", match=MatchAny(any=topics)))
        if min_trust_level:
            must.append(
                FieldCondition(
                    key="source_trust_level", match=MatchValue(value=min_trust_level)
                )
            )

        result = self.qdrant.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            query_filter=Filter(must=must) if must else None,
            limit=limit * 4,  # over-fetch so reranking has room to reorder
            with_payload=True,
        )

        from .sources import topic_boost_for_query

        records: list[dict[str, Any]] = []
        for point in result.points or []:
            payload = dict(point.payload or {})
            raw = float(point.score or 0.0)
            sw = float(payload.get("source_weight") or 1.0)
            tb = topic_boost_for_query(query, payload)
            payload["raw_score"] = raw
            payload["source_weight_applied"] = sw
            payload["topic_boost_applied"] = tb
            payload["score"] = round(raw * sw * tb, 5)
            records.append(payload)

        records.sort(key=lambda r: r["score"], reverse=True)
        return records[:limit]

    def delete_source(self, source_id: str) -> None:
        """Remove all chunks for a given source_id from the collection."""
        self.qdrant.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[FieldCondition(key="source_id", match=MatchValue(value=source_id))]
            ),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Index RAG document corpus into Qdrant")
    parser.add_argument("--source-id", nargs="*", help="Only index these source IDs")
    parser.add_argument("--force", action="store_true", help="Re-fetch even if cached")
    parser.add_argument("--delete", metavar="SOURCE_ID", help="Delete a source from the index")
    parser.add_argument("--search", metavar="QUERY", help="Test search after indexing")
    args = parser.parse_args()

    if args.delete:
        idx = RagIndexer()
        idx.delete_source(args.delete)
        print(f"Deleted chunks for source_id={args.delete}")
        return

    print("=== RAG Indexer ===")
    idx = RagIndexer()

    if not idx.embedder.healthcheck():
        print("ERROR: Ollama not reachable. Start it first: ollama serve")
        return

    summary = index_sources(source_ids=args.source_id, force_fetch=args.force, indexer=idx)
    total = sum(summary.values())
    print(f"\nTotal chunks indexed: {total}")
    for sid, n in summary.items():
        print(f"  {sid}: {n}")

    if args.search:
        print(f"\n=== Test search: '{args.search}' ===")
        results = idx.search(args.search, limit=3)
        for i, r in enumerate(results, 1):
            print(f"[{i}] score={r['raw_score']:.3f} tier={r['tier']} {r['title'][:60]}")
            print(f"     {r['text'][:200]}\n")


if __name__ == "__main__":
    main()
