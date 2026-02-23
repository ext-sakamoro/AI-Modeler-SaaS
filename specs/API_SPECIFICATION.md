# AI Modeler SaaS — API Specification

## Document Info

- **Version**: 1.2.0
- **Created**: 2026-02-23
- **Updated**: 2026-02-23
- **Status**: Core Implemented (21/21 E2E tests passing)
- **OpenAPI Version**: 3.1.0
- **License**: AGPL-3.0 (public) + Commercial License (proprietary)

> **Implementation Note**: Endpoints marked with **[LIVE]** are fully implemented and tested.
> Endpoints marked with **[PLANNED]** are specified but not yet implemented.

---

## Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.ai-modeler.alice.dev/api/v1` |
| Staging | `https://api-staging.ai-modeler.alice.dev/api/v1` |
| Local Dev (API Gateway) | `http://localhost:8080/api/v1` |

### Service Ports (Local Development)

| Service | Port | Direct Access |
|---------|------|---------------|
| API Gateway | 8080 | `http://localhost:8080` (main entry point) |
| SDF Engine | 8081 | `http://localhost:8081` |
| AI-LLM | 8082 | `http://localhost:8082` |
| Collab | 8083 | `http://localhost:8083` |
| Asset | 8084 | `http://localhost:8084` |

## Authentication

### Bearer Token (Web Clients)
```
Authorization: Bearer <jwt_access_token>
```

### API Key (Programmatic Access)
```
X-API-Key: <api_key>
```

### Rate Limits

All rate limits are **operator-configurable** via admin dashboard or environment variables. Default values shown below:

| Tier | Requests/Hour (default) | Concurrent Jobs (default) | Max Mesh Resolution (default) | Max Tree Nodes (default) |
|------|------------------------|--------------------------|------------------------------|-------------------------|
| Free | 100 | 1 | 128^3 | 50 |
| Pro | 10,000 | 10 | 512^3 | 500 |
| Enterprise | Unlimited | 100 | 1024^3 | Unlimited |

Note: Actual values are read from the `plan_configs` table in the database, not hardcoded.

Rate limit headers returned on every response:
```
X-RateLimit-Limit: 10000
X-RateLimit-Remaining: 9987
X-RateLimit-Reset: 1708732800
```

---

## Implemented Endpoints Summary

All endpoints go through the API Gateway (`:8080`) with JWT or API Key authentication.

| Status | Method | Path | Service | Description |
|--------|--------|------|---------|-------------|
| **[LIVE]** | POST | `/api/v1/sdf/compile` | SDF Engine | Compile SDF tree |
| **[LIVE]** | POST | `/api/v1/sdf/eval` | SDF Engine | Evaluate SDF at points |
| **[LIVE]** | POST | `/api/v1/sdf/validate` | SDF Engine | Validate tree structure |
| **[LIVE]** | POST | `/api/v1/mesh/generate` | SDF Engine | Generate polygon mesh |
| **[LIVE]** | POST | `/api/v1/shader/transpile` | SDF Engine | Transpile to shader |
| **[LIVE]** | GET | `/api/v1/primitives` | SDF Engine | List 126 node types |
| **[LIVE]** | POST | `/api/v1/ai/generate` | AI-LLM | Text-to-3D generation |
| **[LIVE]** | GET | `/api/v1/ai/providers` | AI-LLM | List LLM providers |
| **[LIVE]** | GET | `/api/v1/ai/examples` | AI-LLM | Example prompts |
| **[LIVE]** | WS | `/ws/ai/generate` | AI-LLM | Streaming generation |
| **[LIVE]** | POST | `/api/v1/asset/export` | Asset | Export to file |
| **[LIVE]** | GET | `/api/v1/asset/formats` | Asset | List export formats |
| **[LIVE]** | GET | `/api/v1/asset/download/:id` | Asset | Download exported file |
| **[LIVE]** | POST | `/api/v1/collab/sessions` | Collab | Create collab session |
| **[LIVE]** | GET | `/api/v1/collab/sessions/:id` | Collab | Get session info |
| **[LIVE]** | WS | `/ws/collab/:session_id` | Collab | Real-time sync |
| **[LIVE]** | GET | `/health` | Gateway | Health check |
| **[LIVE]** | GET | `/license` | Gateway | License info |
| [PLANNED] | POST | `/api/v1/auth/register` | Auth | User registration |
| [PLANNED] | POST | `/api/v1/auth/login` | Auth | User login |
| [PLANNED] | GET | `/api/v1/projects` | Projects | List projects |
| [PLANNED] | POST | `/api/v1/projects` | Projects | Create project |
| [PLANNED] | GET | `/api/v1/templates` | Templates | List templates |
| [PLANNED] | GET | `/api/v1/analytics/usage` | Analytics | Usage stats |

---

## REST Endpoints

### 1. Authentication [PLANNED]

> Authentication is currently handled by Supabase Auth directly from the frontend.
> The API Gateway validates JWT tokens from Supabase for all `/api/v1/*` routes.

#### POST /auth/register
Create a new account.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "display_name": "John Doe"
}
```

**Response** (201):
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "display_name": "John Doe",
    "plan_tier": "free",
    "created_at": "2026-02-23T10:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MjAyNi0wMi0yM...",
  "expires_in": 900
}
```

#### POST /auth/login
Log in with email and password.

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response** (200): Same as register response.

#### POST /auth/refresh
Refresh an expired access token.

**Request**:
```json
{
  "refresh_token": "v1.MjAyNi0wMi0yM..."
}
```

**Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "v1.MjAyNi0wMi0yN...",
  "expires_in": 900
}
```

#### POST /auth/logout
Invalidate the current session.

**Headers**: `Authorization: Bearer <token>`

**Response** (200):
```json
{ "message": "Logged out successfully" }
```

#### GET /auth/me
Get current user info.

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "display_name": "John Doe",
  "avatar_url": "https://...",
  "plan_tier": "pro",
  "created_at": "2026-02-23T10:00:00Z",
  "usage": {
    "projects_count": 12,
    "projects_limit": 100,
    "api_calls_this_hour": 42,
    "api_calls_limit": 10000
  }
}
```

---

### 2. Projects [PLANNED]

> Project CRUD is currently handled directly by the frontend via Supabase client SDK.
> A dedicated API endpoint is planned for SDK/programmatic access.

#### GET /projects
List user's projects.

**Query Parameters**:
- `page` (int, default: 1)
- `per_page` (int, default: 20, max: 100)
- `sort` (string: "updated_at" | "created_at" | "name", default: "updated_at")
- `order` (string: "asc" | "desc", default: "desc")
- `archived` (bool, default: false)

**Response** (200):
```json
{
  "projects": [
    {
      "id": "proj_abc123",
      "name": "My First Model",
      "description": "A twisted torus with noise",
      "node_count": 7,
      "is_public": false,
      "is_archived": false,
      "created_at": "2026-02-23T10:00:00Z",
      "updated_at": "2026-02-23T12:30:00Z",
      "thumbnail_url": "https://cdn.ai-modeler.alice.dev/thumbs/proj_abc123.webp"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 12,
    "total_pages": 1
  }
}
```

#### POST /projects
Create a new project.

**Request**:
```json
{
  "name": "My New Model",
  "description": "Optional description",
  "sdf_tree": { "Sphere": { "radius": 1.0 } }
}
```

**Response** (201):
```json
{
  "id": "proj_def456",
  "name": "My New Model",
  "sdf_tree": { "Sphere": { "radius": 1.0 } },
  "created_at": "2026-02-23T14:00:00Z"
}
```

#### GET /projects/{id}
Get project details including full SDF tree.

#### PUT /projects/{id}
Update project metadata and/or SDF tree.

#### DELETE /projects/{id}
Delete project (soft delete, recoverable for 30 days).

#### POST /projects/{id}/duplicate
Duplicate a project.

**Response** (201): New project with copied SDF tree.

#### GET /projects/{id}/versions
List version history.

**Response** (200):
```json
{
  "versions": [
    {
      "version_number": 42,
      "node_count": 15,
      "change_description": "Auto-save",
      "created_at": "2026-02-23T12:30:00Z"
    }
  ]
}
```

#### POST /projects/{id}/versions
Create a named snapshot.

---

### 3. SDF Tree [PLANNED]

> SDF tree operations are currently embedded in project data via Supabase.
> The SDF Engine provides compile/eval/validate endpoints for tree processing.

#### GET /projects/{id}/tree
Get the SDF node tree as JSON.

**Response** (200):
```json
{
  "tree": {
    "SmoothUnion": {
      "children": [
        { "Sphere": { "radius": 1.0 } },
        {
          "Translate": {
            "offset": [1.5, 0.0, 0.0],
            "child": { "Box3d": { "size": [0.8, 0.8, 0.8] } }
          }
        }
      ],
      "k": 0.3
    }
  },
  "node_count": 4,
  "depth": 3
}
```

#### PUT /projects/{id}/tree
Replace the entire tree.

#### PATCH /projects/{id}/tree
Apply a tree patch (diff-based update from ALICE-SDF `diff.rs`).

**Request**:
```json
{
  "patch": {
    "operations": [
      { "type": "modify", "path": "/children/0/Sphere/radius", "value": 1.5 },
      { "type": "add", "path": "/children/2", "value": { "Cylinder": { "radius": 0.3, "height": 2.0 } } }
    ]
  }
}
```

#### POST /projects/{id}/tree/validate
Validate tree structure without saving.

**Response** (200):
```json
{
  "valid": true,
  "node_count": 15,
  "depth": 5,
  "warnings": ["Node at /children/3 has no visual effect (zero-radius sphere)"]
}
```

---

### 4. SDF Engine [LIVE]

#### POST /api/v1/sdf/compile
Compile an SDF tree.

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } }
}
```

**Response** (200):
```json
{
  "success": true,
  "node_count": 1,
  "depth": 1,
  "compile_time_ms": 0.5
}
```

#### POST /api/v1/sdf/eval
Evaluate SDF at specific points.

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } },
  "points": [[0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [2.0, 0.0, 0.0]],
  "mode": "default"
}
```

**Response** (200):
```json
{
  "distances": [-1.0, 0.0, 1.0],
  "eval_time_ms": 0.12,
  "point_count": 3,
  "mode": "default"
}
```

#### POST /api/v1/sdf/validate
Validate tree structure without compilation.

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } }
}
```

**Response** (200):
```json
{
  "valid": true,
  "node_count": 1,
  "depth": 1,
  "node_types": ["Sphere"],
  "errors": []
}
```

#### GET /api/v1/primitives
List all available SDF node types.

**Response** (200):
```json
{
  "total": 126,
  "primitives": [
    { "name": "Sphere", "category": "basic", "params": [{"name": "radius", "type": "f32", "default": 1.0}] }
  ],
  "operations": [
    { "name": "SmoothUnion", "category": "smooth", "params": [{"name": "k", "type": "f32", "default": 0.1}] }
  ],
  "transforms": [
    { "name": "Translate", "category": "affine", "params": [{"name": "offset", "type": "vec3"}] }
  ],
  "modifiers": [
    { "name": "Twist", "category": "deform", "params": [{"name": "rate", "type": "f32"}] }
  ]
}
```

---

### 5. Mesh Generation [LIVE]

#### POST /api/v1/mesh/generate
Generate a polygon mesh from an SDF tree via Marching Cubes.

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } },
  "resolution": 128,
  "format": "obj"
}
```

**Response** (200):
```json
{
  "vertex_count": 4832,
  "face_count": 9660,
  "format": "obj",
  "generation_time_ms": 125.3,
  "data_text": "# ALICE-SDF Mesh\nv 0.0 0.0 1.0\n..."
}
```

#### POST /mesh/{id}/decimate [PLANNED]
Decimate mesh to target face count.

#### POST /mesh/{id}/lod [PLANNED]
Generate LOD chain.

#### POST /mesh/{id}/optimize [PLANNED]
Vertex cache optimization (ACMR improvement).

#### POST /mesh/{id}/uv [PLANNED]
UV unwrap (LSCM algorithm).

---

### 6. Export [LIVE]

#### POST /api/v1/asset/export
Export SDF tree to a specific file format.

**Supported Formats** (15 total): `obj`, `stl`, `glb`, `fbx`, `usd`, `alembic`, `ply`, `3mf`, `asdf`, `asdf_json`, `abm`, `nanite`, `wgsl`, `glsl`, `hlsl`

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } },
  "format": "obj",
  "resolution": 128
}
```

**Response** (200):
```json
{
  "export_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "format": "obj",
  "status": "completed",
  "download_url": "/api/v1/asset/download/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### GET /api/v1/asset/formats
List all supported export formats.

**Response** (200):
```json
{
  "total": 15,
  "formats": [
    { "name": "OBJ", "extension": "obj", "category": "mesh", "description": "Wavefront OBJ" },
    { "name": "STL", "extension": "stl", "category": "mesh", "description": "Stereolithography" },
    { "name": "GLB", "extension": "glb", "category": "mesh", "description": "glTF 2.0 Binary" }
  ]
}
```

#### GET /api/v1/asset/download/:export_id
Download an exported file.

**Response**: Binary file with `Content-Disposition: attachment; filename="export.obj"` header.

---

### 7. Shader Transpilation [LIVE]

#### POST /api/v1/shader/transpile
Transpile SDF tree to shader source code.

**Supported Targets**: `wgsl` (WebGPU), `glsl` (Unity/OpenGL), `hlsl` (UE5/DirectX)

**Request**:
```json
{
  "tree": { "type": "Sphere", "params": { "radius": 1.0 } },
  "target": "wgsl"
}
```

**Response** (200):
```json
{
  "target": "wgsl",
  "source": "fn sdf_eval(p: vec3<f32>) -> f32 {\n  return length(p) - 1.0;\n}\n",
  "transpile_time_ms": 0.3
}
```

---

### 8. Text-to-3D (AI) [LIVE]

#### POST /api/v1/ai/generate
Generate an SDF tree from natural language.

**Request**:
```json
{
  "prompt": "a rounded cube with a cylindrical hole through the center",
  "provider": "auto",
  "quality": "standard"
}
```

**Providers**: `auto` (waterfall: Claude > Gemini > OpenAI), `anthropic`, `google`, `openai`

**Response** (200):
```json
{
  "sdf_tree": {
    "type": "SmoothSubtraction",
    "params": { "k": 0.05 },
    "a": { "type": "RoundedBox", "params": { "size": [1.0, 1.0, 1.0], "radius": 0.1 } },
    "b": { "type": "Cylinder", "params": { "radius": 0.3, "height": 2.0 } }
  },
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "generation_time_ms": 2340.0,
  "cached": false
}
```

#### GET /api/v1/ai/providers
List available LLM providers.

**Response** (200):
```json
{
  "providers": ["anthropic", "google", "openai"]
}
```

#### GET /api/v1/ai/examples
List example prompts for text-to-3D.

**Response** (200):
```json
{
  "examples": [
    { "prompt": "A simple sphere", "difficulty": "beginner" },
    { "prompt": "A snowman made of three stacked spheres", "difficulty": "beginner" },
    { "prompt": "A rounded cube with a cylindrical hole through the center", "difficulty": "intermediate" },
    { "prompt": "An alien mushroom forest with twisted stems", "difficulty": "advanced" }
  ]
}
```

#### WebSocket /ws/ai/generate
Streaming text-to-3D generation.

**Client sends**:
```json
{ "prompt": "a twisted torus", "provider": "auto", "quality": "standard" }
```

**Server streams**: Chunks of the generation process, final message contains the complete `sdf_tree`.

#### POST /ai/refine [PLANNED]
Iteratively refine an existing SDF tree.

---

### 9. Templates [PLANNED]

> Template gallery endpoints are planned for Phase 2. Templates table exists in the database (006_templates.sql).

#### GET /templates
List templates with pagination and filtering.

**Query Parameters**:
- `category` (string: "architectural", "mechanical", "organic", "abstract", "game_assets")
- `tags` (string[], comma-separated)
- `featured` (bool)
- `sort` (string: "use_count", "created_at", "name")
- `page`, `per_page`

#### GET /templates/{id}
Get template details and SDF tree.

#### POST /templates
Create a template from a project.

**Request**:
```json
{
  "project_id": "proj_abc123",
  "name": "Twisted Torus",
  "description": "A torus with twist modifier and noise displacement",
  "category": "abstract",
  "tags": ["torus", "twisted", "procedural"]
}
```

#### GET /templates/featured
Get featured templates (curated by admins).

#### GET /templates/search?q={query}
Full-text search across template names and descriptions.

---

### 10. Analytics [PLANNED]

> Analytics endpoints are planned for Phase 2. The api_usage table exists in the database (007_api_usage.sql).

#### GET /analytics/usage
Get usage statistics for the current user.

**Query Parameters**: `period` ("7d", "30d", "90d", "custom"), `start`, `end`

**Response** (200):
```json
{
  "period": "30d",
  "projects_created": 8,
  "models_exported": 23,
  "api_calls": 1247,
  "compute_hours": 0.34,
  "text_to_3d_requests": 15,
  "top_export_formats": [
    { "format": "glb", "count": 12 },
    { "format": "stl", "count": 8 },
    { "format": "obj", "count": 3 }
  ]
}
```

---

## WebSocket API

### Implemented WebSocket Endpoints

#### Collaboration WebSocket [LIVE]

```
ws://localhost:8083/ws/collab/:session_id
```

(via API Gateway: `ws://localhost:8080/ws/collab/:session_id`)

**Protocol**: Messages are JSON-encoded `CollabMessage` objects. The server validates and normalizes incoming messages, then broadcasts to all session participants.

**Message Format**:
```json
{
  "type": "tree_update",
  "user_id": "user-uuid",
  "patch": { "...tree patch data..." },
  "cursor": { "position": [0, 0, 0], "node_id": "node-1" },
  "timestamp": 1708700000
}
```

**Supported `type` values**: `tree_update`, `cursor_move`, `selection_change`, `join`, `leave`

**Session Management**:
- Create session: `POST /api/v1/collab/sessions` with `{ "project_id": "..." }`
- Get session info: `GET /api/v1/collab/sessions/:session_id`
- Connect: `GET /ws/collab/:session_id` (WebSocket upgrade)

#### AI Streaming WebSocket [LIVE]

```
ws://localhost:8082/ws/ai/generate
```

(via API Gateway: `ws://localhost:8080/ws/ai/generate`)

**Client sends**:
```json
{ "prompt": "a twisted torus", "provider": "auto", "quality": "standard" }
```

**Server streams**: Chunks of the generation process, final message contains the complete `sdf_tree`.

### Planned WebSocket Channels

The following channels are planned for future implementation:

| Type | Channel | Payload | Description |
|------|---------|---------|-------------|
| `tree:update` | `editor:*` | `{ patch: TreePatch }` | Send tree modification |
| `cursor:move` | `collab:*` | `{ position: [x,y,z], node_id: string }` | Update cursor position |
| `selection:change` | `collab:*` | `{ node_ids: string[] }` | Update selection |
| `eval:request` | `preview:*` | `{ point: [x,y,z] }` | Request single eval |
| `tree:conflict` | `editor:*` | `{ node_id, your_change, their_change }` | Conflict notification |
| `export:progress` | `editor:*` | `{ job_id, progress: 0.0-1.0, status }` | Export job progress |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have exceeded your API rate limit (100/hr for Free tier)",
    "status": 429,
    "details": {
      "limit": 100,
      "remaining": 0,
      "reset_at": "2026-02-23T15:00:00Z",
      "upgrade_url": "https://ai-modeler.alice.dev/dashboard/billing"
    }
  }
}
```

### Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_SDF_TREE` | Malformed SDF node tree |
| 400 | `INVALID_PARAMETERS` | Invalid request parameters |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 401 | `TOKEN_EXPIRED` | JWT access token has expired |
| 403 | `PLAN_LIMIT_EXCEEDED` | Operation exceeds subscription tier limits |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `TREE_CONFLICT` | Concurrent tree modification conflict |
| 413 | `TREE_TOO_LARGE` | SDF tree exceeds node count limit |
| 429 | `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Server-side error |
| 503 | `ENGINE_OVERLOADED` | SDF engine at capacity, retry later |

---

## SDK Examples

### JavaScript / TypeScript

```typescript
import { AIModelerClient } from '@alice/ai-modeler-sdk';

const client = new AIModelerClient({ apiKey: 'sk_live_...' });

// Text-to-3D
const { tree } = await client.ai.textToSdf({
  prompt: 'a rounded cube with a cylindrical hole through the center',
  style: 'geometric',
});

// Compile
const { compiledId } = await client.engine.compile({ tree });

// Generate mesh
const { meshId } = await client.mesh.generate({
  compiledId,
  method: 'marching_cubes',
  resolution: 256,
});

// Export to GLB
const { downloadUrl } = await client.export('glb', {
  meshId,
  options: { draco_compression: true },
});

console.log(`Download: ${downloadUrl}`);
```

### Python

```python
from alice_modeler import Client

client = Client(api_key="sk_live_...")

# Text-to-3D
result = client.ai.text_to_sdf(
    prompt="a twisted torus with noise displacement",
    style="organic",
)

# Or build programmatically
tree = client.sdf.smooth_subtract(
    client.sdf.rounded_box([1.0, 1.0, 1.0], radius=0.1),
    client.sdf.cylinder(0.3, 2.0),
    k=0.05,
)

# Compile + mesh + export in one call
url = client.quick_export(tree, format="stl", resolution=256)
print(f"Download: {url}")
```

### cURL (Using Actual Endpoints)

```bash
BASE_URL="http://localhost:8080"  # API Gateway

# 1. Compile SDF tree
curl -s -X POST "$BASE_URL/api/v1/sdf/compile" \
  -H "Content-Type: application/json" \
  -d '{"tree": {"type": "Sphere", "params": {"radius": 1.0}}}'

# 2. Generate mesh (OBJ format, resolution 128)
curl -s -X POST "$BASE_URL/api/v1/mesh/generate" \
  -H "Content-Type: application/json" \
  -d '{"tree": {"type": "Sphere", "params": {"radius": 1.0}}, "resolution": 128, "format": "obj"}'

# 3. Transpile to WGSL shader
curl -s -X POST "$BASE_URL/api/v1/shader/transpile" \
  -H "Content-Type: application/json" \
  -d '{"tree": {"type": "Sphere", "params": {"radius": 1.0}}, "target": "wgsl"}'

# 4. Export to STL
curl -s -X POST "$BASE_URL/api/v1/asset/export" \
  -H "Content-Type: application/json" \
  -d '{"tree": {"type": "Sphere", "params": {"radius": 1.0}}, "format": "stl", "resolution": 128}'

# 5. Text-to-3D generation
curl -s -X POST "$BASE_URL/api/v1/ai/generate" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a rounded cube with a cylindrical hole", "provider": "auto"}'

# 6. List available primitives
curl -s "$BASE_URL/api/v1/primitives"

# 7. List export formats
curl -s "$BASE_URL/api/v1/asset/formats"

# 8. Health check
curl -s "$BASE_URL/health"
```
