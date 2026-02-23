"""AI Modeler SaaS - AI/LLM Service for text-to-3D generation."""

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    GenerateRequest,
    GenerateResponse,
    HealthResponse,
)
from services.llm_service import LLMService
from services.cache_service import CacheService


llm_service: LLMService | None = None
cache_service: CacheService | None = None
start_time: float = 0


@asynccontextmanager
async def lifespan(app: FastAPI):
    global llm_service, cache_service, start_time
    start_time = time.time()
    llm_service = LLMService()
    cache_service = CacheService()
    yield
    if cache_service:
        await cache_service.close()


app = FastAPI(
    title="AI Modeler SaaS - LLM Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok",
        version="0.1.0",
        uptime_secs=int(time.time() - start_time),
        providers=llm_service.available_providers() if llm_service else [],
    )


@app.post("/api/v1/ai/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    if not llm_service:
        raise HTTPException(status_code=503, detail="LLM service not initialized")

    # Check cache first
    if cache_service:
        cached = await cache_service.get(req.prompt, req.provider)
        if cached:
            return GenerateResponse(
                sdf_tree=cached["sdf_tree"],
                provider=cached.get("provider", req.provider),
                model=cached.get("model", "cached"),
                generation_time_ms=0.0,
                cached=True,
            )

    start = time.time()
    try:
        result = await llm_service.generate(
            prompt=req.prompt,
            provider=req.provider,
            quality=req.quality,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    elapsed_ms = (time.time() - start) * 1000

    response = GenerateResponse(
        sdf_tree=result["sdf_tree"],
        provider=result["provider"],
        model=result["model"],
        generation_time_ms=elapsed_ms,
        cached=False,
    )

    # Cache the result
    if cache_service:
        await cache_service.set(req.prompt, req.provider, result)

    return response


@app.websocket("/ws/ai/generate")
async def ws_generate(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            prompt = data.get("prompt", "")
            provider = data.get("provider", "auto")
            quality = data.get("quality", "standard")

            if not prompt:
                await websocket.send_json({"error": "Empty prompt"})
                continue

            if not llm_service:
                await websocket.send_json({"error": "LLM service not initialized"})
                continue

            await websocket.send_json({"status": "generating", "prompt": prompt})

            try:
                async for chunk in llm_service.generate_stream(
                    prompt=prompt,
                    provider=provider,
                    quality=quality,
                ):
                    await websocket.send_json(chunk)
            except Exception as e:
                await websocket.send_json({"error": str(e)})

    except WebSocketDisconnect:
        pass


@app.get("/api/v1/ai/providers")
async def list_providers():
    if not llm_service:
        return {"providers": []}
    return {"providers": llm_service.available_providers()}


@app.get("/api/v1/ai/examples")
async def list_examples():
    return {
        "examples": [
            {"prompt": "A simple sphere", "difficulty": "beginner"},
            {"prompt": "A snowman made of three spheres", "difficulty": "beginner"},
            {"prompt": "A rounded cube with a cylindrical hole through the center", "difficulty": "intermediate"},
            {"prompt": "A castle tower with battlements", "difficulty": "intermediate"},
            {"prompt": "An alien mushroom forest with repeating organic shapes", "difficulty": "advanced"},
            {"prompt": "A mechanical gear with teeth arranged in a polar pattern", "difficulty": "advanced"},
            {"prompt": "A twisted column with floating spheres orbiting around it", "difficulty": "advanced"},
            {"prompt": "A treasure chest with a barrel-shaped body", "difficulty": "advanced"},
            {"prompt": "A decorative star badge with diamond accents", "difficulty": "advanced"},
        ]
    }
