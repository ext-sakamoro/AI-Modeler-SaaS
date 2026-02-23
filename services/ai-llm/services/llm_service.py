"""LLM integration for text-to-3D SDF generation.

Supports Claude (Anthropic), Gemini (Google), and OpenAI as providers.
Adapted from ALICE-SDF server/services/llm_service.py.
"""

import json
import os
import re
from typing import Any, AsyncIterator


# System prompt for SDF generation
SYSTEM_PROMPT = """You are an expert 3D modeler that creates shapes using Signed Distance Functions (SDF).
Given a natural language description, generate a valid SDF tree in JSON format.

Available primitive types:
- Sphere: {radius: f32}
- Box3d: {half_size: [f32,f32,f32]}
- Cylinder: {radius: f32, half_height: f32}
- Torus: {major_radius: f32, minor_radius: f32}
- Plane: {}
- Capsule: {radius: f32, half_height: f32}
- Cone: {radius: f32, height: f32}
- RoundedBox: {half_size: [f32,f32,f32], radius: f32}
- Ellipsoid: {radii: [f32,f32,f32]}
- Pyramid: {height: f32, base: f32}
- Octahedron: {size: f32}
- StarPolygon: {r_outer: f32, r_inner: f32, n: u32}
- Gyroid: {scale: f32, thickness: f32}

Boolean operations (require "a" and "b" children):
- Union, Intersection, Subtraction
- SmoothUnion: {k: f32}, SmoothIntersection: {k: f32}, SmoothSubtraction: {k: f32}

Transforms (require "child"):
- Translate: {offset: [f32,f32,f32]}
- RotateEuler: {angles: [f32,f32,f32]}
- Scale: {factor: f32}

Modifiers (require "child"):
- Twist: {strength: f32}
- Bend: {strength: f32}
- Repeat: {spacing: [f32,f32,f32]}
- RepeatFinite: {spacing: [f32,f32,f32], count: [i32,i32,i32]}
- Mirror: {axis: [f32,f32,f32]}
- PolarRepeat: {count: u32, radius: f32}
- Noise: {amplitude: f32, frequency: f32}
- Shell: {thickness: f32}
- Onion: {thickness: f32}

Coordinate system: Y-up, keep shapes within [-5, 5] range.
Use half_ prefix for dimensions (half_size means total size is 2x).

Output ONLY valid JSON. No markdown, no explanation. Just the JSON object.
Example output:
{"type": "SmoothUnion", "params": {"k": 0.3}, "a": {"type": "Sphere", "params": {"radius": 1.0}}, "b": {"type": "Translate", "params": {"offset": [0, 1.5, 0]}, "child": {"type": "Sphere", "params": {"radius": 0.7}}}}
"""


class LLMService:
    """Multi-provider LLM service for text-to-3D SDF generation."""

    def __init__(self):
        self._claude_client = None
        self._gemini_client = None
        self._openai_client = None
        self._init_providers()

    def _init_providers(self):
        # Claude (Anthropic)
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if api_key:
            try:
                import anthropic
                self._claude_client = anthropic.AsyncAnthropic(api_key=api_key)
            except ImportError:
                pass

        # Gemini (Google)
        api_key = os.environ.get("GOOGLE_AI_API_KEY")
        if api_key:
            try:
                from google import genai
                self._gemini_client = genai.Client(api_key=api_key)
            except ImportError:
                pass

        # OpenAI
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            try:
                import openai
                self._openai_client = openai.AsyncOpenAI(api_key=api_key)
            except ImportError:
                pass

    def available_providers(self) -> list[str]:
        providers = []
        if self._claude_client:
            providers.append("claude")
        if self._gemini_client:
            providers.append("gemini")
        if self._openai_client:
            providers.append("openai")
        return providers

    def _select_provider(self, provider: str) -> str:
        available = self.available_providers()
        if not available:
            raise RuntimeError("No LLM providers configured. Set ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OPENAI_API_KEY.")
        if provider == "auto":
            # Prefer Claude > Gemini > OpenAI
            return available[0]
        if provider not in available:
            raise ValueError(f"Provider '{provider}' not available. Available: {available}")
        return provider

    def _get_model(self, provider: str, quality: str) -> str:
        models = {
            "claude": {
                "fast": "claude-haiku-4-5-20251001",
                "standard": "claude-sonnet-4-6",
                "high": "claude-opus-4-6",
            },
            "gemini": {
                "fast": "gemini-2.0-flash",
                "standard": "gemini-2.0-flash",
                "high": "gemini-2.5-pro",
            },
            "openai": {
                "fast": "gpt-4o-mini",
                "standard": "gpt-4o",
                "high": "gpt-4o",
            },
        }
        return models.get(provider, {}).get(quality, "claude-sonnet-4-6")

    async def generate(self, prompt: str, provider: str = "auto", quality: str = "standard") -> dict[str, Any]:
        provider = self._select_provider(provider)
        model = self._get_model(provider, quality)

        if provider == "claude":
            return await self._generate_claude(prompt, model)
        elif provider == "gemini":
            return await self._generate_gemini(prompt, model)
        elif provider == "openai":
            return await self._generate_openai(prompt, model)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    async def _generate_claude(self, prompt: str, model: str) -> dict[str, Any]:
        response = await self._claude_client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text
        sdf_tree = self._extract_json(text)
        return {"sdf_tree": sdf_tree, "provider": "claude", "model": model}

    async def _generate_gemini(self, prompt: str, model: str) -> dict[str, Any]:
        from google.genai import types
        response = await self._gemini_client.aio.models.generate_content(
            model=model,
            contents=f"{SYSTEM_PROMPT}\n\nUser request: {prompt}",
            config=types.GenerateContentConfig(
                max_output_tokens=4096,
                temperature=0.7,
            ),
        )
        text = response.text
        sdf_tree = self._extract_json(text)
        return {"sdf_tree": sdf_tree, "provider": "gemini", "model": model}

    async def _generate_openai(self, prompt: str, model: str) -> dict[str, Any]:
        response = await self._openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=4096,
            temperature=0.7,
        )
        text = response.choices[0].message.content
        sdf_tree = self._extract_json(text)
        return {"sdf_tree": sdf_tree, "provider": "openai", "model": model}

    async def generate_stream(self, prompt: str, provider: str = "auto", quality: str = "standard") -> AsyncIterator[dict]:
        provider = self._select_provider(provider)
        model = self._get_model(provider, quality)

        yield {"status": "started", "provider": provider, "model": model}

        try:
            if provider == "claude":
                async with self._claude_client.messages.stream(
                    model=model,
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": prompt}],
                ) as stream:
                    full_text = ""
                    async for text in stream.text_stream:
                        full_text += text
                        yield {"status": "streaming", "chunk": text}

                sdf_tree = self._extract_json(full_text)
                yield {"status": "completed", "sdf_tree": sdf_tree, "provider": provider, "model": model}

            elif provider == "gemini":
                result = await self._generate_gemini(prompt, model)
                yield {"status": "completed", "sdf_tree": result["sdf_tree"], "provider": provider, "model": model}

            elif provider == "openai":
                stream = await self._openai_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=4096,
                    stream=True,
                )
                full_text = ""
                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        text = chunk.choices[0].delta.content
                        full_text += text
                        yield {"status": "streaming", "chunk": text}

                sdf_tree = self._extract_json(full_text)
                yield {"status": "completed", "sdf_tree": sdf_tree, "provider": provider, "model": model}

        except Exception as e:
            yield {"status": "error", "error": str(e)}

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from LLM response, handling markdown fences."""
        # Try direct parse
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Remove markdown code fences
        patterns = [
            r"```json\s*(.*?)\s*```",
            r"```\s*(.*?)\s*```",
            r"\{.*\}",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                candidate = match.group(1) if match.lastindex else match.group(0)
                try:
                    return json.loads(candidate)
                except json.JSONDecodeError:
                    continue

        # Try to repair common JSON issues
        repaired = self._repair_json(text)
        if repaired:
            return repaired

        raise ValueError(f"Could not extract valid JSON from LLM response")

    def _repair_json(self, text: str) -> dict | None:
        """Attempt to repair broken JSON."""
        # Find the first { and try to balance braces
        start = text.find("{")
        if start == -1:
            return None

        depth = 0
        end = start
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break

        if depth > 0:
            # Add missing closing braces
            candidate = text[start:] + "}" * depth
        else:
            candidate = text[start:end]

        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return None
