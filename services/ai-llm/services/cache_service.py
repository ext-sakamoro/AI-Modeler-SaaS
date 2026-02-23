"""Redis-based cache for LLM responses."""

import hashlib
import json
import os
from typing import Any


class CacheService:
    """Cache LLM responses in Redis."""

    def __init__(self):
        self._client = None
        self._ttl = int(os.environ.get("LLM_CACHE_TTL", "86400"))
        redis_url = os.environ.get("REDIS_URL")
        if redis_url:
            try:
                import redis.asyncio as aioredis
                self._client = aioredis.from_url(redis_url, decode_responses=True)
            except ImportError:
                pass

    def _cache_key(self, prompt: str, provider: str) -> str:
        h = hashlib.sha256(f"{prompt}:{provider}".encode()).hexdigest()[:16]
        return f"ai-modeler:llm:{h}"

    async def get(self, prompt: str, provider: str) -> dict | None:
        if not self._client:
            return None
        try:
            key = self._cache_key(prompt, provider)
            data = await self._client.get(key)
            if data:
                return json.loads(data)
        except Exception:
            pass
        return None

    async def set(self, prompt: str, provider: str, result: dict[str, Any]) -> None:
        if not self._client:
            return
        try:
            key = self._cache_key(prompt, provider)
            await self._client.setex(key, self._ttl, json.dumps(result))
        except Exception:
            pass

    async def close(self):
        if self._client:
            await self._client.aclose()
