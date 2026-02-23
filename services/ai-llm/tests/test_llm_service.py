"""Tests for the LLM service."""

import pytest
from services.llm_service import LLMService


def test_extract_json_direct():
    svc = LLMService.__new__(LLMService)
    result = svc._extract_json('{"type": "Sphere", "params": {"radius": 1.0}}')
    assert result["type"] == "Sphere"
    assert result["params"]["radius"] == 1.0


def test_extract_json_markdown_fence():
    svc = LLMService.__new__(LLMService)
    text = '```json\n{"type": "Box3d", "params": {"half_size": [0.5, 0.5, 0.5]}}\n```'
    result = svc._extract_json(text)
    assert result["type"] == "Box3d"


def test_extract_json_with_text():
    svc = LLMService.__new__(LLMService)
    text = 'Here is the SDF:\n{"type": "Cylinder", "params": {"radius": 0.5, "half_height": 1.0}}\nDone.'
    result = svc._extract_json(text)
    assert result["type"] == "Cylinder"


def test_repair_json_missing_brace():
    svc = LLMService.__new__(LLMService)
    text = '{"type": "Sphere", "params": {"radius": 1.0}'
    result = svc._repair_json(text)
    assert result is not None
    assert result["type"] == "Sphere"
