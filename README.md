# AI Modeler SaaS

Cloud-native 3D modeling platform powered by ALICE-SDF.

**"Don't send polygons. Send the law of shapes."**

AI Modeler SaaS democratizes procedural geometry creation by exposing
ALICE-SDF's industrial-strength SDF engine through a browser-based interface.
Users describe shapes in natural language or build them visually with CSG
operations, and the platform compiles, evaluates, and exports production-ready
3D assets in real-time.

## Status

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | 0 errors |
| ESLint (`eslint --max-warnings 0`) | 0 errors, 0 warnings |
| SDF Engine (`cargo check`) | 0 errors, 0 warnings |
| API Gateway (`cargo check`) | 0 errors, 0 warnings |
| Collab (`cargo check`) | 0 errors, 0 warnings |
| Asset (`cargo check`) | 0 errors, 0 warnings |
| AI-LLM (`py_compile`) | 0 errors |
| E2E Smoke Tests | **21/21 PASS (100%)** |

## Quick Start

```bash
git clone https://github.com/ext-sakamoro/AI-Modeler-SaaS.git
cd AI-Modeler-SaaS
cp .env.example .env  # Edit with your API keys
docker compose up -d
```

Open http://localhost:3000 in your browser.

### Local Development (Without Docker)

```bash
# Terminal 1: SDF Engine
cd services/sdf-engine && cargo run --release
# Listening on 0.0.0.0:8081

# Terminal 2: API Gateway
cd services/api-gateway && cargo run --release
# Listening on 0.0.0.0:8080

# Terminal 3: Collab Service
cd services/collab && cargo run --release
# Listening on 0.0.0.0:8083

# Terminal 4: Asset Service
cd services/asset && cargo run --release
# Listening on 0.0.0.0:8084

# Terminal 5: AI-LLM Service
cd services/ai-llm && pip install -r requirements.txt && uvicorn app.main:app --port 8082
# Listening on 0.0.0.0:8082

# Terminal 6: Frontend
cd frontend && npm install && npm run dev
# Listening on http://localhost:3000
```

## Architecture

```
                    ┌──────────────────┐
                    │   Frontend       │
                    │   Next.js 15     │
                    │   :3000          │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   API Gateway    │
                    │   Rust/Axum      │
                    │   :8080          │
                    │   JWT + Rate Lim │
                    └──┬──┬──┬──┬─────┘
           ┌───────────┘  │  │  └───────────┐
           ▼              ▼  ▼              ▼
    ┌──────────┐  ┌────────┐ ┌──────┐  ┌────────┐
    │SDF Engine│  │AI-LLM  │ │Collab│  │ Asset  │
    │Rust/Axum │  │FastAPI  │ │  WS  │  │Service │
    │  :8081   │  │ :8082   │ │:8083 │  │ :8084  │
    └──────────┘  └─────────┘ └──────┘  └────────┘
```

| Service | Tech | Port | Description |
|---------|------|------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS | 3000 | Web UI with dashboard, editor, export |
| **API Gateway** | Rust (Axum 0.7) | 8080 | JWT auth, rate limiting, reverse proxy |
| **SDF Engine** | Rust (Axum 0.7) | 8081 | Compile, eval, mesh gen, shader transpile |
| **AI-LLM** | Python (FastAPI) | 8082 | Text-to-3D via Claude/Gemini/OpenAI |
| **Collab** | Rust (Axum 0.7, WebSocket) | 8083 | Real-time collaborative editing |
| **Asset** | Rust (Axum 0.7) | 8084 | File export, download, format listing |
| **Database** | PostgreSQL 16 + Supabase Auth | 5432 | User data, projects, plans |
| **Cache** | Redis 7 | 6379 | Rate limiting, session cache |
| **Billing** | Stripe | - | Operator-configurable pricing |

## Implemented API Endpoints

All endpoints are accessible through the API Gateway at `:8080`. Authentication is required (JWT Bearer or API Key).

### SDF Engine

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/sdf/compile` | Compile SDF tree to bytecode |
| POST | `/api/v1/sdf/eval` | Evaluate SDF at given points |
| POST | `/api/v1/sdf/validate` | Validate tree structure |
| POST | `/api/v1/mesh/generate` | Generate polygon mesh (Marching Cubes) |
| POST | `/api/v1/shader/transpile` | Transpile SDF to WGSL/GLSL/HLSL shader |
| GET | `/api/v1/primitives` | List all 126 SDF node types |

### AI / Text-to-3D

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/ai/generate` | Generate SDF tree from natural language |
| GET | `/api/v1/ai/providers` | List available LLM providers |
| GET | `/api/v1/ai/examples` | List example prompts |
| WS | `/ws/ai/generate` | Streaming text-to-3D generation |

### Asset / Export

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/asset/export` | Export mesh to file (15 formats) |
| GET | `/api/v1/asset/formats` | List all supported export formats |
| GET | `/api/v1/asset/download/:export_id` | Download exported file |

### Collaboration

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/collab/sessions` | Create collaboration session |
| GET | `/api/v1/collab/sessions/:session_id` | Get session info |
| WS | `/ws/collab/:session_id` | WebSocket for real-time sync |

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Gateway health check |
| GET | `/license` | AGPL-3.0 license info |

## Frontend Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Marketing page |
| `/auth/login` | Login | Email/password + OAuth |
| `/auth/register` | Register | New account creation |
| `/auth/callback` | Callback | OAuth callback handler |
| `/dashboard` | Dashboard | Redirects to `/dashboard/projects` |
| `/dashboard/projects` | Projects | Project list + create new |
| `/dashboard/editor` | Editor | SDF tree editor + WebGPU viewport |
| `/dashboard/export` | Export | Multi-format export (10 formats) |
| `/dashboard/settings` | Settings | API key management, account info |
| `/dashboard/billing` | Billing | Stripe subscription management |

## Features

- 126 SDF node types (72 primitives, 24 operations, 7 transforms, 23 modifiers)
- 7 evaluation modes (interpreted, compiled, SIMD, BVH, SoA, JIT, GPU)
- 15 export formats (OBJ, GLB, FBX, USD, STL, 3MF, Nanite, shaders...)
- Text-to-3D via LLM (Claude, Gemini, OpenAI)
- Real-time WebGPU preview
- Collaborative editing via WebSocket
- REST + WebSocket API for programmatic access
- Supabase Auth (email/password + OAuth)
- Stripe billing with operator-configurable pricing
- Project save/load with Supabase
- API key generation and persistence

## Database

9 migration files in `database/migrations/`:

| File | Description |
|------|-------------|
| `001_users.sql` | User profiles, extensions, RLS |
| `002_projects.sql` | Projects table + indexes |
| `003_sdf_trees.sql` | SDF tree version history |
| `004_exports.sql` | Exported assets tracking |
| `005_plan_configs.sql` | Configurable plan limits |
| `006_templates.sql` | Template gallery |
| `007_api_usage.sql` | API usage logging |
| `008_collab_sessions.sql` | Collaboration sessions |
| `009_functions.sql` | Database functions |

## License

Dual licensed:

- **AGPL-3.0** (public) -- SaaS operators must publish complete service source code
- **Commercial License** (proprietary) -- contact for closed-source deployment

See [LICENSE](./LICENSE) for the AGPL-3.0 text.

## Related Projects

| Project | Description | Link |
|---------|-------------|------|
| **ALICE-Eco-System** | 52-component integration layer (bridges, pipelines) | [ext-sakamoro/ALICE-Eco-System](https://github.com/ext-sakamoro/ALICE-Eco-System) |
| **ALICE-SDF** | Core SDF engine (126 node types, 7 eval modes, 15 formats) | [ext-sakamoro/ALICE-SDF](https://github.com/ext-sakamoro/ALICE-SDF) |

## Documentation

See [specs/](./specs/) for detailed specifications:

- [PROJECT_OVERVIEW.md](./specs/PROJECT_OVERVIEW.md) -- Project vision and roadmap
- [REQUIREMENTS.md](./specs/REQUIREMENTS.md) -- Functional and non-functional requirements
- [ARCHITECTURE.md](./specs/ARCHITECTURE.md) -- System architecture and data flow
- [API_SPECIFICATION.md](./specs/API_SPECIFICATION.md) -- Complete API reference
- [DEPLOYMENT.md](./specs/DEPLOYMENT.md) -- Docker, Helm, cloud provider guides
