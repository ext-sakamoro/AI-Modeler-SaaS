# AI Modeler SaaS — Architecture Specification

## Document Info

- **Version**: 1.2.0
- **Created**: 2026-02-23
- **Updated**: 2026-02-23
- **Status**: Core Implemented (21/21 E2E tests passing)
- **License**: AGPL-3.0 (public) + Commercial License (proprietary, direct sales)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Client Layer                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  Web App    │  │  REST API   │  │ WebSocket  │  │ CLI (future)  │  │
│  │ (Next.js 15)│  │  Clients   │  │  Clients   │  │               │  │
│  │ + WebGPU    │  │  (SDK)     │  │  (Collab)  │  │               │  │
│  └──────┬──────┘  └──────┬─────┘  └──────┬─────┘  └───────┬──────┘  │
└─────────┼────────────────┼───────────────┼─────────────────┼─────────┘
          │                │               │                 │
          ▼                ▼               ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ALICE-API Gateway (Rust/Axum)                                 │  │
│  │  — TLS termination, JWT validation, rate limiting, routing     │  │
│  └──────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────────┐
          ▼                   ▼                       ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  SDF Engine Svc  │  │  Asset Service   │  │ Collaboration Svc    │
│  (Rust Native)   │  │  (Export/Mesh)   │  │ (WebSocket Sync)     │
│                  │  │                  │  │                      │
│  • compile       │  │  • mesh gen      │  │  • tree diff/patch   │
│  • eval (SIMD)   │  │  • decimation    │  │  • cursor presence   │
│  • raycast (BVH) │  │  • LOD chain     │  │  • undo/redo sync    │
│  • shader xpile  │  │  • UV unwrap     │  │  • conflict resolve  │
│  • tree validate │  │  • format encode │  │                      │
└────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘
         │                    │                       │
         ▼                    ▼                       ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐
│  AI/LLM Service  │  │ Billing Service  │  │  Agent Service       │
│                  │  │                  │  │  (OmniCreator)       │
│  • text-to-SDF   │  │  • Stripe subs   │  │                      │
│  • iterative     │  │  • usage billing │  │  • 3D modeling agent │
│    refinement    │  │  • invoice mgmt  │  │  • material agent    │
│  • Claude/Gemini │  │  • tier enforce  │  │  • optimization      │
│    /OpenAI       │  │                  │  │  • MessageBus        │
└────────┬────────┘  └────────┬────────┘  └──────────┬───────────┘
         │                    │                       │
         └────────────────────┼───────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Data & Storage Layer                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Supabase   │  │ ALICE-Cache│  │ ALICE-CDN  │  │ Supabase     │  │
│  │ PostgreSQL │  │ (Dist.     │  │ (Asset     │  │ Storage      │  │
│  │ + Auth     │  │  Cache)    │  │  Delivery) │  │ (Files)      │  │
│  └────────────┘  └────────────┘  └────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ALICE Eco-System Integration                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ bridge_sdf   │  │bridge_physics│  │ bridge_codec             │  │
│  │ SDF→Analytics │  │ SDF→Collider │  │ SDF→Wavelet Compression │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ bridge_asp   │  │ Pipeline B-1 │  │ Pipeline G               │  │
│  │ SDF→Stream   │  │ Asset Deliver│  │ AI Inference             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. Frontend (Next.js 15 + WebGPU)

**Framework**: Next.js 15 with App Router (React 19, TypeScript)

**Key Technologies**:
- WebGPU for real-time SDF rendering (WGSL shaders transpiled from CompiledSdf)
- ALICE-SDF WASM module for client-side lightweight evaluation
- Zustand for local state management
- Supabase Realtime for collaborative sync
- Radix UI + Tailwind CSS for component library

**Page Structure** (Implemented):

| Route | Component | Description | Status |
|-------|-----------|-------------|--------|
| `/` | LandingPage | Marketing page | LIVE |
| `/auth/login` | LoginPage | Email/password + OAuth login | LIVE |
| `/auth/register` | RegisterPage | New account creation | LIVE |
| `/auth/callback` | CallbackPage | OAuth callback handler | LIVE |
| `/dashboard` | Dashboard | Redirects to `/dashboard/projects` | LIVE |
| `/dashboard/projects` | ProjectsPage | Project list + create new | LIVE |
| `/dashboard/editor` | EditorPage | SDF tree editor + WebGPU viewport | LIVE |
| `/dashboard/export` | ExportPage | Multi-format export (15 formats) | LIVE |
| `/dashboard/settings` | SettingsPage | API key management, account info | LIVE |
| `/dashboard/billing` | BillingPage | Stripe subscription management | LIVE |

**Editor Layout** (Implemented):

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Project Name] [Save] ──── [Compile] [Mesh] [WGSL]│
├──────────────┬──────────────────────────┬───────────────────┤
│  Left Panel  │                          │  Right Panel      │
│  (w-80)      │    WebGPU 3D Viewport    │  (w-80)           │
│              │    (center, flex-1)      │                   │
│  Text-to-3D  │                          │  WGSL Shader      │
│  ┌────────┐  │    [3D Preview Area      │  Output           │
│  │Prompt  │  │     with SDF info]       │                   │
│  │        │  │                          │  Mesh Output      │
│  └────────┘  │                          │  (OBJ)            │
│  [Generate]  │                          │                   │
│              │                          │                   │
│  SDF Tree    │                          │                   │
│  (JSON)      │                          │                   │
│  ┌────────┐  │                          │                   │
│  │  {...} │  │                          │                   │
│  └────────┘  │                          │                   │
└──────────────┴──────────────────────────┴───────────────────┘
```

### 2. SDF Engine Service (Rust)

**Runtime**: Native Rust binary served via Axum HTTP framework

**Core Pipeline**:

```
SdfNode (JSON)
    │
    ▼
┌──────────────┐
│   Compiler    │  SdfNode → CompiledSdf
│   compiler.rs │  (AST → flat bytecode + aux_data)
└──────┬───────┘
       │
       ▼
CompiledSdf
    │
    ├──▶ eval.rs           → Single-point scalar evaluation
    ├──▶ eval_simd.rs      → SIMD 8-wide batch (AVX2/NEON)
    ├──▶ eval_bvh.rs       → BVH-accelerated pruning
    ├──▶ eval_soa.rs       → Structure-of-Arrays batch
    ├──▶ jit/codegen.rs    → JIT native code (Cranelift)
    ├──▶ wgsl/transpiler.rs → WGSL shader source
    ├──▶ glsl/transpiler.rs → GLSL shader source
    └──▶ hlsl/transpiler.rs → HLSL shader source
```

**Endpoints** (Axum routes — all LIVE):

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| POST | `/api/v1/sdf/compile` | `compile_handler` | Compile SDF tree to bytecode |
| POST | `/api/v1/sdf/eval` | `eval_handler` | Evaluate SDF at given points |
| POST | `/api/v1/sdf/validate` | `validate_handler` | Validate SDF tree structure |
| POST | `/api/v1/mesh/generate` | `mesh_handler` | Generate polygon mesh (Marching Cubes) |
| POST | `/api/v1/shader/transpile` | `shader_handler` | Transpile to WGSL/GLSL/HLSL |
| GET | `/api/v1/primitives` | `primitives_handler` | List all 126 SDF node types |

**Scaling Strategy**:
- Stateless pods (compiled SDF cached by content hash in ALICE-Cache)
- Horizontal Pod Autoscaler (HPA) targeting 70% CPU utilization
- Warm pool: 2 minimum replicas always running
- Max replicas: 16 (configurable per environment)

### 3. Asset Service

**Responsibility**: Mesh generation, post-processing, format encoding, file delivery

**Mesh Generation Pipeline**:

```
CompiledSdf + Bounds + Resolution
    │
    ▼
┌──────────────────────────────┐
│  Mesh Generation             │
│  ├─ Marching Cubes (default) │
│  ├─ Adaptive MC (detail)     │
│  ├─ Dual Contouring (sharp)  │
│  └─ GPU MC (massive batches) │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Post-Processing Pipeline    │
│  1. Manifold validation      │
│  2. Mesh repair (if needed)  │
│  3. Decimation (QEM)         │
│  4. LOD chain generation     │
│  5. Vertex cache optimization│
│  6. UV unwrap (LSCM)         │
│  7. Lightmap UV (optional)   │
│  8. Collision mesh (optional)│
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Format Encoding             │
│  ├─ OBJ  (wavefront)        │
│  ├─ GLB  (glTF 2.0 binary)  │
│  ├─ FBX  (Autodesk)         │
│  ├─ USD  (Pixar)            │
│  ├─ ABC  (Alembic)          │
│  ├─ STL  (3D print)         │
│  ├─ PLY  (Stanford)         │
│  ├─ 3MF  (Microsoft)        │
│  ├─ ASDF (native binary)    │
│  ├─ ABM  (ALICE LOD mesh)   │
│  └─ Nanite (UE5 clusters)   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│  Delivery                    │
│  ├─ Upload to Supabase Store │
│  ├─ Push to ALICE-CDN        │
│  └─ Return download URL      │
└──────────────────────────────┘
```

### 4. Collaboration Service

**Protocol**: Based on ALICE-SDF `diff.rs` module (tree_diff / apply_patch)

**Sync Architecture**:

```
User A (Editor)                Server                User B (Editor)
    │                            │                        │
    ├── Edit: add Sphere ──────▶│                        │
    │                            ├── tree_diff() ───────▶│
    │                            │   TreePatch {          │
    │                            │     add: [Sphere@3]    │
    │                            │   }                    │
    │                            │                        ├── apply_patch()
    │                            │                        │   → tree updated
    │                            │                        │
    │                            │◀── Edit: modify Box ──┤
    │◀── tree_diff() ───────────┤                        │
    │    TreePatch {             │                        │
    │      modify: [Box@1.size] │                        │
    │    }                       │                        │
    ├── apply_patch()            │                        │
    │   → tree updated           │                        │
```

**Conflict Resolution**:
1. Non-overlapping edits: Apply both patches (commutative)
2. Same-node edits: Last-write-wins with notification to earlier writer
3. Structural conflicts (reparenting): Lock subtree during operation

### 5. AI/LLM Integration

**Text-to-SDF Pipeline**:

```
User Prompt
    │
    ▼
┌──────────────────────────────────┐
│  Prompt Template                  │
│  "Generate an ALICE-SDF tree     │
│   using the following schema:    │
│   {llm_schema}                   │
│   User request: {prompt}         │
│   Style: {style}                 │
│   Complexity: {complexity}"      │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  LLM Provider (waterfall)        │
│  1. Anthropic Claude             │
│  2. Google Gemini (fallback)     │
│  3. OpenAI (fallback)            │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Response Validation             │
│  • JSON schema validation        │
│  • SdfNode tree structure check  │
│  • Compile test (must succeed)   │
│  • Render test (bounds check)    │
└──────────────┬───────────────────┘
               │
               ▼
Valid SdfNode Tree
```

**LLM Schema** (from ALICE-SDF `llm_schema.rs`):
- Describes all 126 node types with parameter schemas
- Includes CSG operation semantics
- Provides few-shot examples for common shapes
- Constrains output to valid SdfNode JSON

### 6. Billing Service

**Stripe Integration Points**:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record in DB |
| `customer.subscription.updated` | Update plan tier, enforce new limits |
| `customer.subscription.deleted` | Downgrade to Free tier |
| `invoice.payment_succeeded` | Log payment, update billing dashboard |
| `invoice.payment_failed` | Notify user, grace period (configurable) |

**Configurable Pricing Architecture**:

All pricing and plan limits are stored in the database or environment variables — **zero hardcoded amounts** in the source code:

```
┌──────────────────────────────────────────────────────┐
│  Plan Configuration (DB: plan_configs table)          │
│                                                       │
│  {                                                    │
│    "tier": "pro",                                     │
│    "stripe_price_id": "price_xxx",  ← set by operator│
│    "limits": {                                        │
│      "max_projects": 100,           ← configurable   │
│      "max_resolution": 512,         ← configurable   │
│      "api_rate_per_hour": 10000,    ← configurable   │
│      "text_to_3d_per_day": 500,     ← configurable   │
│      "collab_max_users": 5          ← configurable   │
│    },                                                 │
│    "features": ["all_formats", "api_access", ...]     │
│  }                                                    │
└──────────────────────────────────────────────────────┘
```

**Tier Enforcement Middleware**:

```
Request → API Gateway → Tier Check Middleware → Service
                              │
                              ├── Load plan config from DB/cache
                              ├── Check: project count < tier limit?
                              ├── Check: API calls < rate limit?
                              ├── Check: mesh resolution ≤ tier max?
                              └── Check: export format in allowed list?
                              │
                              ├── Pass → Forward to service
                              └── Fail → 403 Forbidden + upgrade prompt
```

**AGPL-3.0 License Enforcement**:
- A license notice is embedded in all API responses via `X-License: AGPL-3.0` header
- `/license` endpoint serves the full AGPL-3.0 text and source code access instructions
- Commercial License holders are identified by a `license_key` in their configuration

---

## Database Schema

### Entity-Relationship Diagram

```mermaid
erDiagram
    users ||--o{ projects : owns
    users ||--o{ api_keys : has
    users ||--|| subscriptions : has
    users ||--o{ usage_logs : generates
    projects ||--o{ project_versions : has
    projects ||--o{ assets : produces
    projects ||--o{ collab_sessions : has
    templates }o--|| users : "authored by"

    users {
        uuid id PK
        text email UK
        text display_name
        text avatar_url
        text plan_tier
        timestamp created_at
        timestamp updated_at
    }

    projects {
        uuid id PK
        uuid user_id FK
        text name
        text description
        jsonb sdf_tree
        bytea compiled_bytecode
        boolean is_public
        boolean is_archived
        timestamp created_at
        timestamp updated_at
    }

    project_versions {
        uuid id PK
        uuid project_id FK
        integer version_number
        jsonb sdf_tree
        text change_description
        timestamp created_at
    }

    assets {
        uuid id PK
        uuid project_id FK
        text format
        text file_path
        bigint file_size_bytes
        integer resolution
        jsonb mesh_stats
        timestamp created_at
        timestamp expires_at
    }

    templates {
        uuid id PK
        uuid author_id FK
        text name
        text description
        jsonb sdf_tree
        text category
        text[] tags
        boolean is_featured
        integer use_count
        timestamp created_at
    }

    api_keys {
        uuid id PK
        uuid user_id FK
        text key_hash UK
        text name
        text[] permissions
        integer rate_limit_per_hour
        timestamp created_at
        timestamp last_used_at
        timestamp revoked_at
    }

    subscriptions {
        uuid id PK
        uuid user_id FK UK
        text stripe_customer_id
        text stripe_subscription_id
        text plan_tier
        text status
        timestamp current_period_start
        timestamp current_period_end
        timestamp created_at
    }

    usage_logs {
        uuid id PK
        uuid user_id FK
        text endpoint
        text method
        integer response_time_ms
        integer compute_ms
        timestamp created_at
    }

    collab_sessions {
        uuid id PK
        uuid project_id FK
        uuid[] user_ids
        jsonb cursor_positions
        timestamp created_at
        timestamp last_activity_at
    }
```

### Key Indexes

```sql
-- Performance-critical indexes
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX idx_project_versions_project_id ON project_versions(project_id, version_number DESC);
CREATE INDEX idx_assets_project_id ON assets(project_id);
CREATE INDEX idx_assets_expires_at ON assets(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_templates_category ON templates(category, is_featured DESC, use_count DESC);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);
CREATE INDEX idx_usage_logs_user_created ON usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
```

---

## Deployment Architecture

### Kubernetes Cluster

```
┌──────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster (GKE / EKS)                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Ingress Controller (Cloudflare Tunnel / nginx)          │ │
│  └────────────────────────┬────────────────────────────────┘ │
│                           │                                   │
│  ┌────────────────────────┴────────────────────────────────┐ │
│  │  Namespace: ai-modeler-prod                              │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────┐                             │ │
│  │  │ Frontend  │  │ Frontend  │  Deployment (replicas: 2-4)│ │
│  │  │ Next.js   │  │ Next.js   │                            │ │
│  │  └──────────┘  └──────────┘                             │ │
│  │                                                          │ │
│  │  ┌──────────┐                                           │ │
│  │  │ API GW   │  Deployment (replicas: 2)                 │ │
│  │  │ Rust/Axum│                                           │ │
│  │  └──────────┘                                           │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │ │
│  │  │SDF Engine│  │SDF Engine│  │SDF Engine│  HPA (2-16)  │ │
│  │  │ Rust Pod │  │ Rust Pod │  │ Rust Pod │              │ │
│  │  └──────────┘  └──────────┘  └──────────┘             │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │ │
│  │  │ Asset Svc│  │ Collab   │  │ AI/LLM   │  (1-4 each) │ │
│  │  │          │  │ Svc (WS) │  │ Service   │             │ │
│  │  └──────────┘  └──────────┘  └──────────┘             │ │
│  │                                                          │ │
│  │  ┌──────────┐  ┌──────────┐                             │ │
│  │  │ Billing  │  │ Agent Svc│  (1-2 each)                │ │
│  │  │ Service  │  │ (Omni)   │                             │ │
│  │  └──────────┘  └──────────┘                             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│  External Services:                                           │
│  • Supabase Cloud or Self-Hosted (PostgreSQL + Auth + Storage)│
│  • Stripe API (Billing — configurable pricing)                │
│  • Anthropic/Google/OpenAI APIs (LLM)                         │
│  • Cloudflare or provider-native (CDN + DNS + DDoS)           │
└──────────────────────────────────────────────────────────────┘

### Multi-Cloud Support

| Provider | Kubernetes | Database | Storage | CDN |
|----------|-----------|----------|---------|-----|
| **AWS** | EKS | Supabase Cloud / RDS | S3 + Supabase Storage | CloudFront |
| **Google Cloud** | GKE | Supabase Cloud / Cloud SQL | GCS + Supabase Storage | Cloud CDN |
| **Azure** | AKS | Supabase Cloud / Azure DB | Blob Storage + Supabase | Azure CDN |
| **Self-Hosted** | k3s / kubeadm | Self-hosted Supabase | Local / MinIO | ALICE-CDN |

All infrastructure components are abstracted behind environment variables:
```
# Cloud provider selection
CLOUD_PROVIDER=aws|gcp|azure|self-hosted
K8S_CLUSTER_TYPE=eks|gke|aks|k3s

# Database (Supabase — managed or self-hosted)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# Stripe (operator configures their own Stripe account)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# LLM providers
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
OPENAI_API_KEY=sk-...
```
```

### Resource Estimates

| Service | CPU (request/limit) | Memory (request/limit) | Replicas |
|---------|--------------------|-----------------------|----------|
| Frontend (Next.js) | 250m / 500m | 256Mi / 512Mi | 2-4 |
| API Gateway (Rust) | 250m / 500m | 128Mi / 256Mi | 2 |
| SDF Engine (Rust) | 1000m / 2000m | 512Mi / 1Gi | 2-16 (HPA) |
| Asset Service | 500m / 1000m | 256Mi / 512Mi | 1-4 |
| Collaboration (WS) | 250m / 500m | 128Mi / 256Mi | 2 |
| AI/LLM Service | 250m / 500m | 256Mi / 512Mi | 1-2 |
| Billing Service | 100m / 250m | 128Mi / 256Mi | 1 |
| Agent Service | 250m / 500m | 256Mi / 512Mi | 1-2 |

---

## Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 15.x | Web application framework |
| | React | 19.x | UI library |
| | TypeScript | 5.x | Type safety |
| | Radix UI | latest | Accessible component primitives |
| | Tailwind CSS | 3.x | Utility-first CSS |
| | Zustand | 4.x | Client state management |
| | WebGPU | — | Real-time 3D rendering |
| **Backend** | Rust | 1.75+ | SDF engine, API gateway |
| | Axum | 0.7+ | HTTP/WebSocket server |
| | ALICE-SDF | 1.1.0 | SDF evaluation, compilation, mesh gen |
| | tokio | 1.x | Async runtime |
| | serde | 1.x | Serialization |
| **WASM** | wasm-bindgen | — | Rust → WASM bridge |
| | ALICE-SDF (wasm) | 1.1.0 | Client-side SDF eval |
| **Database** | Supabase | — | Managed PostgreSQL 16 |
| | PgBouncer | — | Connection pooling |
| **Cache** | ALICE-Cache | — | Distributed eval cache |
| **CDN** | ALICE-CDN | — | Asset delivery |
| | Cloudflare | — | Edge caching, DDoS |
| **Auth** | Supabase Auth | — | OAuth, JWT |
| **Billing** | Stripe | — | Subscriptions, invoices |
| **AI/LLM** | Anthropic Claude | latest | Text-to-SDF (primary) |
| | Google Gemini | latest | Text-to-SDF (fallback) |
| | OpenAI | latest | Text-to-SDF (fallback) |
| **Observability** | ALICE-Semantic-Telemetry | — | Metrics, tracing |
| | OpenTelemetry | — | Distributed tracing |
| | Grafana | — | Dashboards |
| **Infrastructure** | Docker | — | Containerization |
| | Kubernetes | 1.28+ | Orchestration (EKS/GKE/AKS/k3s) |
| | GitHub Actions | — | CI/CD |
| | Cloudflare Tunnel | — | Ingress (or provider-native) |
| **License** | AGPL-3.0 | — | Public license (SaaS copyleft) |
| | Commercial | — | Enterprise license (direct sales) |

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment specifications:
- **Docker Compose**: `docker compose up -d` (60-second local deploy)
- **Helm Chart**: `helm install ai-modeler ./charts/ai-modeler` (production K8s)
- **One-Click Deploy**: Railway, Render, DigitalOcean, Vercel buttons
- **Cloud-Specific**: AWS EKS, GCP GKE, Azure AKS guides with values overrides

---

## ALICE Eco-System Integration

### Bridge Modules Used

| Bridge | Source | Target | Purpose |
|--------|--------|--------|---------|
| `bridge_sdf.rs` | ALICE-SDF | Analytics, DB, Edge, Cache | Core SDF data flow |
| `bridge_physics.rs` | ALICE-SDF | ALICE-Physics | Collision mesh generation |
| `bridge_codec.rs` | ALICE-SDF | ALICE-Codec | 3D wavelet compression |
| `bridge_asp.rs` | ALICE-SDF | ALICE-Streaming-Protocol | Real-time asset delivery |
| `bridge_cache.rs` | ALICE-SDF | ALICE-Cache | Evaluation result caching |
| `bridge_font.rs` | ALICE-Font | ALICE-SDF | Text/glyph SDF conversion |

### Pipeline Paths

| Path | Name | Flow | SaaS Usage |
|------|------|------|------------|
| **B-1** | Asset Delivery | SDF → CDN → Cache | Exported mesh delivery to users |
| **G** | AI Inference | ML → TRT → SDF | Text-to-3D neural backbone |
| **D** | Content Production | VCS → SDF → Animation + Font | Template/asset pipeline |

### Content Hash Integration

All SDF operations produce content-hashed results via `bridge_sdf.rs`:
- Identical SDF trees → identical `content_hash: u64` (FNV-1a)
- Used for: cache key, deduplication, CDN invalidation
- Zero-copy bridge pattern: no serialization overhead

---

## Security Architecture

### Authentication Flow

```
┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Client│───▶│Supabase  │───▶│  JWT     │───▶│  API     │
│      │    │Auth      │    │  (15min) │    │  Gateway │
│      │    │(OAuth/   │    │          │    │          │
│      │    │ email)   │    │+ Refresh │    │  Rate    │
│      │    │          │    │  (7 day) │    │  Limit   │
└──────┘    └──────────┘    └──────────┘    └──────────┘
                                                  │
                                                  ▼
                                            ┌──────────┐
                                            │  Service  │
                                            │  (Authed) │
                                            └──────────┘
```

### API Key Flow

```
┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Client│───▶│X-API-Key │───▶│  Decrypt │───▶│  Verify  │
│(SDK) │    │Header    │    │  (AES256)│    │  + Rate  │
│      │    │          │    │          │    │  Limit   │
└──────┘    └──────────┘    └──────────┘    └──────────┘
```

### Data Protection

| Data Type | At Rest | In Transit | Access Control |
|-----------|---------|------------|----------------|
| User credentials | Supabase (bcrypt) | TLS 1.3 | Supabase Auth |
| API keys | AES-256 encrypted | TLS 1.3 | User-scoped |
| SDF trees | PostgreSQL (encrypted vol) | TLS 1.3 | Project owner + collaborators |
| Exported meshes | Supabase Storage | TLS 1.3 / CDN HTTPS | Signed URLs (24h expiry) |
| Usage logs | PostgreSQL | TLS 1.3 | Admin only |
