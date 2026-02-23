"""Pydantic models for the AI/LLM service."""

from pydantic import BaseModel, Field
from typing import Any


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_secs: int
    providers: list[str]


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    provider: str = Field(default="auto", description="LLM provider: auto, claude, gemini, openai")
    quality: str = Field(default="standard", description="Quality level: fast, standard, high")


class GenerateResponse(BaseModel):
    sdf_tree: dict[str, Any]
    provider: str
    model: str
    generation_time_ms: float
    cached: bool = False
