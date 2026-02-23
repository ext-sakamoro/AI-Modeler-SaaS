# AI Modeler SaaS — Project Overview

## Vision

A cloud-native 3D modeling platform that democratizes procedural geometry creation by exposing ALICE-SDF's industrial-strength SDF engine through a browser-based interface. Users describe shapes in natural language or build them visually with CSG operations, and the platform compiles, evaluates, and exports production-ready 3D assets in real-time.

**Tagline**: *"Don't send polygons. Send the law of shapes."*

## Problem Statement

1. **Steep Learning Curves**: Traditional 3D modeling tools (Blender, Maya, ZBrush) require months of training
2. **Coding Barrier**: Procedural/parametric modeling (OpenSCAD, Houdini VEX) requires programming skills
3. **No Real-Time SDF SaaS**: No existing cloud service provides real-time SDF evaluation with WebGPU rendering
4. **Export Fragmentation**: Artists need multiple tools to export to different formats (OBJ, GLB, FBX, USD, STL...)
5. **Collaboration Gap**: 3D model collaboration lacks real-time sync capabilities comparable to Figma/Google Docs

## Solution

AI Modeler SaaS bridges these gaps by combining:

1. **Natural Language Interface**: "Create a rounded cube with a cylindrical hole" → ALICE-SDF CSG tree automatically generated via LLM
2. **Visual CSG Editor**: Drag-and-drop 126 SDF node types with real-time WebGPU preview at 60fps
3. **One-Click Export**: 15 formats (OBJ, GLB, FBX, USD, Alembic, STL, PLY, 3MF, ASDF, Nanite...) from a single SDF definition
4. **Collaborative Editing**: Real-time multi-user editing via ALICE-SDF tree diff/patch synchronization
5. **API-First Design**: REST + WebSocket API for programmatic access, enabling pipeline integration

## Core Technology

### ALICE-SDF v1.1.0 (Rust)
- **126 SDF Node Types**: 72 primitives + 24 operations + 7 transforms + 23 modifiers
- **7 Evaluation Modes**: Interpreted, Compiled Scalar, SIMD 8-wide, BVH, SoA, JIT (Cranelift), GPU Compute (wgpu)
- **15 I/O Formats**: ASDF, OBJ, GLB, FBX, USD, Alembic, STL, PLY, 3MF, ABM, Nanite, and more
- **Mesh Generation**: Marching Cubes, Adaptive MC, Dual Contouring, GPU MC
- **Shader Transpilation**: WGSL (WebGPU), GLSL (OpenGL/Unity), HLSL (UE5/DirectX)
- **Quality**: 1,003 tests passing, 0 clippy warnings, 0 doc warnings

### OmniCreatorTemplate (Next.js 15 SaaS Platform)
- **Frontend**: Next.js 15 App Router, React 19, TypeScript, Radix UI, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage), Stripe billing
- **Agent System**: 50+ implemented agents with MessageBus orchestration
- **Spec System**: Automated specification generation framework

### ALICE-Eco-System (Integration Layer)
- **63 Bridge Modules**: Connecting 51 ALICE crates via zero-copy pipelines
- **Key Bridges**: bridge_sdf.rs (SDF ↔ Analytics/DB/Edge/Cache), bridge_physics.rs, bridge_codec.rs
- **Pipeline Paths**: B-1 (Asset Delivery), G (AI Inference), and 18 more domain-specific pipelines

## Target Users

| Segment | Use Case | Key Features |
|---------|----------|-------------|
| **Game Developers** | Procedural asset generation | LOD chains, collision meshes, Nanite export, HLSL shaders |
| **3D Print Enthusiasts** | Printable model creation | STL/3MF export, manifold validation, mesh repair |
| **VFX Artists** | High-quality asset pipeline | USD/Alembic export, dual contouring, lightmap UVs |
| **Architects** | Parametric design | Constraint solver, parametric relationships, terrain |
| **AI Researchers** | Text-to-3D pipeline | REST API, batch evaluation, programmatic SDF construction |
| **Educators** | Interactive SDF learning | Template gallery, visual CSG editor, real-time feedback |
| **Indie Studios** | Rapid prototyping | Text-to-3D, agent-assisted modeling, one-click export |
| **Enterprise (Licensed)** | Closed-source product integration | Commercial License, no AGPL obligation, dedicated support |

## Licensing Strategy

### Dual License Model

AI Modeler SaaS uses a **dual licensing** strategy to protect the technology while keeping it open-source:

| License | Target | Key Obligation |
|---------|--------|---------------|
| **AGPL-3.0** (Public) | Community, researchers, indie devs | SaaS operators must publish entire service source code |
| **Commercial License** (Proprietary) | Enterprises (Adobe, Google, NVIDIA, etc.) | No source disclosure — closed-source deployment permitted |

**Why AGPL-3.0?**

The AGPL-3.0 "network use" clause is the strongest copyleft weapon against free-riding:
- Any entity operating this code as a service (SaaS) must release the **complete source code** of their service
- Large enterprises with proprietary codebases (Adobe, Google, NVIDIA, AWS, etc.) **cannot accept this** — they must purchase a Commercial License
- Cloud providers (AWS, GCP, Azure) cannot offer "managed ALICE SDF" without licensing
- The community gets full open-source access; corporations pay for the right to keep their code private

**Commercial License Revenue**:
- Sold directly by the copyright holder
- Pricing negotiated per contract (enterprise scale, potentially significant per-deal)
- Includes: no AGPL obligation, priority support, SLA, custom integration

## Business Model

### Subscription Tiers (Configurable Pricing)

All plan pricing is **operator-configurable** — no hardcoded amounts in the codebase. The operator sets prices via admin dashboard or environment variables at deployment time.

| Tier | Projects | Preview | Export Formats | API Rate | Key Features |
|------|----------|---------|---------------|----------|-------------|
| **Free** | Limited | Basic | Basic formats (OBJ, STL) | Limited | Community support |
| **Pro** | Expanded | Full resolution | All 15 formats | Higher | All 126 node types, text-to-3D, API access |
| **Enterprise** | Unlimited | Maximum | All + custom | Unlimited | SSO, private instance, SLA, dedicated support |

### Revenue Streams
1. **SaaS Subscriptions**: Stripe-powered recurring billing (operator sets prices)
2. **Commercial Licenses**: Direct enterprise sales (AGPL-3.0 bypass, high-value contracts)
3. **Usage-Based Billing**: Compute-heavy operations (mesh generation, GPU evaluation)
4. **Support Contracts**: Priority/dedicated support tiers

## Key Metrics (Success Criteria)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first model | < 2 minutes | From signup to exported OBJ |
| SDF evaluation latency | < 16ms | 256^3 grid, SIMD + Rayon |
| WebGPU preview framerate | 60fps | 1080p, reference hardware |
| Mesh generation speed | < 3 seconds | Marching Cubes 256^3 |
| API response time | P95 < 200ms | All read endpoints |
| Export throughput | 15 formats | All producing valid files |
| Text-to-3D success rate | > 90% | 100 test prompts |
| Uptime | 99.9% | Monthly measurement |
| Monthly Active Users | 10,000+ | Within 12 months |

## Timeline

### Phase 1: Core Platform (Weeks 1-4) — IN PROGRESS

| Feature | Status | Details |
|---------|--------|---------|
| SDF Engine Rust server | **DONE** | 6 endpoints: compile, eval, validate, mesh, shader, primitives |
| API Gateway | **DONE** | JWT auth, token bucket rate limiting, reverse proxy to 4 services |
| AI-LLM Service | **DONE** | Text-to-3D via Claude/Gemini/OpenAI, streaming WebSocket |
| Collab Service | **DONE** | WebSocket broadcast, session management |
| Asset Service | **DONE** | Export (15 formats), download, format listing |
| Frontend (Next.js 15) | **DONE** | 10 pages: auth, dashboard, editor, export, settings, billing |
| Supabase Auth + project CRUD | **DONE** | Email/password + OAuth, project load/save |
| Stripe billing | **DONE** | Checkout, webhook, plan management |
| Database migrations | **DONE** | 9 migration files (001-009) |
| E2E smoke tests | **DONE** | 21/21 PASS (100%) |
| Zero errors/warnings | **DONE** | TypeScript, ESLint, 4 Rust services, Python — all 0 errors, 0 warnings |
| WASM compilation | Planned | Client-side SDF evaluation |
| WebGPU renderer | Planned | Real-time WGSL shader preview |

### Phase 2: Full Feature Set (Weeks 5-8)
- Template gallery (50+ templates)
- Analytics dashboard
- Advanced editor UI (drag-and-drop node tree, visual CSG)
- OpenAPI documentation at `/api-docs`
- SDK libraries (JavaScript/TypeScript, Python)

### Phase 3: Enterprise & Scale (Weeks 9-12)
- Advanced collaborative editing (tree diff/patch, conflict resolution)
- Agent-assisted modeling
- Enterprise features (SSO, custom deployment)
- ALICE-Eco-System integration (CDN, Cache, Analytics)
- Terrain, destruction, advanced analysis
- Load testing and optimization

## Competitive Landscape

| Competitor | Strengths | Our Advantage |
|-----------|-----------|---------------|
| Blender (free) | Full 3D suite, huge community | Cloud-native, no install, text-to-3D, real-time collab |
| Shapr3D | iPad-native CAD | SDF-native workflow, 126 primitives, API access |
| OpenSCAD | Programmatic CSG | No coding required, real-time preview, LLM integration |
| Spline.design | Web-based 3D | SDF engine (not mesh-based), 15 export formats, SIMD performance |
| Meshy.ai | AI 3D generation | SDF precision (not mesh approximation), parametric editing, deterministic output |
| AWS/GCP managed 3D | Cloud scale | AGPL-3.0 prevents them from offering closed-source forks without licensing |

## Related Documents

- [REQUIREMENTS.md](./REQUIREMENTS.md) — Detailed requirements
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architecture design
- [API_SPECIFICATION.md](./API_SPECIFICATION.md) — API documentation (18 LIVE + 6 PLANNED endpoints)
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker Compose, Helm, AWS/GCP/Azure guides
