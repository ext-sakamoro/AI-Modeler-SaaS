# AI Modeler SaaS — Requirements Specification

## Document Info

- **Version**: 1.2.0
- **Created**: 2026-02-23
- **Updated**: 2026-02-23
- **Status**: Phase 1 In Progress (Core Platform Implemented)
- **License**: AGPL-3.0 (public) + Commercial License (proprietary, direct sales)

---

## Functional Requirements

### FR-001: SDF Node Tree Construction

- **Priority**: HIGH
- **Category**: Core Engine
- **Description**: Users can construct SDF trees using the full ALICE-SDF v1.1.0 node vocabulary (126 types total):
  - **72 Primitives**: Sphere, Box3d, Cylinder, Torus, Plane, Capsule, Cone, Ellipsoid, RoundedCone, Pyramid, Octahedron, HexPrism, Link, Triangle, Bezier, RoundedBox, CappedCone, CappedTorus, RoundedCylinder, TriangularPrism, CutSphere, CutHollowSphere, DeathStar, SolidAngle, Rhombus, Horseshoe, Vesica, Heart, Tube, Barrel, ChamferedCube, Superellipsoid, RoundedX, Pie, Trapezoid, Parallelogram, Tunnel, UnevenCapsule, Egg, ArcShape, Moon, CrossShape, BlobbyCross, ParabolaSegment, RegularPolygon, StarPolygon, StairsPrim, Helix, BoxFrame, Tetrahedron, Dodecahedron, Icosahedron, TruncatedOctahedron, TruncatedIcosahedron, Gyroid, SchwarzP, DiamondSurface, Neovius, Lidinoid, IWP, FRD, FischerKochS, PMY, Circle2d, Rect2d, Segment2d, Polygon2d, RoundedRect2d, Annular2d, InfiniteCylinder, InfiniteCone
  - **24 Operations**: Union, Intersection, Subtraction, SmoothUnion, SmoothIntersection, SmoothSubtraction, ChamferUnion, ChamferIntersection, ChamferSubtraction, StairsUnion, StairsIntersection, StairsSubtraction, ExpSmoothUnion, ExpSmoothIntersection, ExpSmoothSubtraction, ColumnsUnion, ColumnsIntersection, ColumnsSubtraction, Xor, Morph, Pipe, Engrave, Groove, Tongue
  - **7 Transforms**: Translate, RotateEuler, RotateQuat, Scale, ScaleNonUniform, ProjectiveTransform, LatticeDeform, SdfSkinning
  - **23 Modifiers**: Twist, Bend, Repeat, RepeatFinite, Mirror, MirrorOctant, IFS, Noise, Displacement, HeightmapDisplacement, SurfaceRoughness, Sweep, Extrude, Revolution, PolarRepeat, IcosahedralSymmetry, Taper, Shell, Onion

- **Acceptance Criteria**:
  - [ ] All 126 SDF node types are selectable in the editor UI
  - [x] Node tree is serializable to/from JSON via serde
  - [x] Tree validation endpoint rejects malformed structures with descriptive errors (`POST /api/v1/sdf/validate`)
  - [ ] Drag-and-drop node reordering works correctly
  - [ ] Node parameter editing updates preview in real-time (< 100ms)

---

### FR-002: Real-Time WebGPU Preview

- **Priority**: HIGH
- **Category**: Rendering
- **Description**: Real-time 3D preview in the browser using WebGPU. ALICE-SDF's CompiledSdf is transpiled to WGSL shaders and executed as a sphere-tracing raymarcher. Includes soft shadows, ambient occlusion, and PBR material preview.

- **Acceptance Criteria**:
  - [ ] 60fps at 1080p on reference hardware (RTX 3060 / Apple M1)
  - [ ] 30fps at 4K resolution (Pro/Enterprise tier)
  - [ ] Shader compilation < 500ms for trees up to 200 nodes
  - [ ] Interactive camera: orbit, pan, zoom with mouse/trackpad
  - [ ] Grid floor, coordinate axes, bounding box visualization
  - [ ] Fallback to WebGL 2.0 for unsupported browsers

---

### FR-003: Text-to-3D Generation

- **Priority**: HIGH
- **Category**: AI/LLM
- **Description**: Natural language descriptions are converted to valid SDF node trees via LLM integration. Uses ALICE-SDF's `llm_schema` module for structured JSON output. Supports iterative refinement.

- **LLM Providers** (priority order):
  1. Anthropic Claude (primary)
  2. Google Gemini (fallback)
  3. OpenAI (fallback)

- **Acceptance Criteria**:
  - [ ] 90%+ success rate generating valid SDF trees from geometric descriptions
  - [ ] Response time < 5s (simple), < 15s (complex)
  - [ ] Iterative refinement preserves unmodified subtrees
  - [x] All generated trees compile and render without errors (validated via `/api/v1/sdf/compile`)
  - [ ] Style modes: geometric, organic, mechanical, abstract
  - [ ] Complexity levels: simple (< 10 nodes), medium (10-50), complex (50-200)

---

### FR-004: Multi-Format Export

- **Priority**: HIGH
- **Category**: I/O
- **Description**: Export meshes generated from SDF trees to all 15 ALICE-SDF I/O formats.

| Format | Extension | Use Case | Free | Pro | Enterprise |
|--------|-----------|----------|------|-----|------------|
| ASDF | .asdf | Native binary (lossless) | - | Yes | Yes |
| ASDF-JSON | .asdf.json | Native JSON (human-readable) | - | Yes | Yes |
| OBJ | .obj | Universal interchange | Yes | Yes | Yes |
| GLB | .glb | Web/glTF ecosystem | - | Yes | Yes |
| FBX | .fbx | Autodesk ecosystem | - | Yes | Yes |
| USD | .usd/.usda | Pixar/VFX pipeline | - | Yes | Yes |
| Alembic | .abc | Animation/VFX | - | Yes | Yes |
| STL | .stl | 3D printing | Yes | Yes | Yes |
| PLY | .ply | Point cloud/scan | - | Yes | Yes |
| 3MF | .3mf | Advanced 3D printing | - | Yes | Yes |
| ABM | .abm | ALICE Binary Mesh (LOD) | - | Yes | Yes |
| Nanite | .nanite | UE5 hierarchical clusters | - | - | Yes |

- **Acceptance Criteria**:
  - [x] All 15 formats produce files importable by target applications (`POST /api/v1/asset/export`)
  - [x] Mesh generation (256^3 MC) completes in < 3 seconds (`POST /api/v1/mesh/generate`)
  - [ ] LOD chain auto-generated (L0=100%, L1=50%, L2=25%, L3=12.5%)
  - [ ] Configurable resolution: 64^3 (Free), up to 512^3 (Pro), up to 1024^3 (Enterprise)
  - [x] Download links available (`GET /api/v1/asset/download/:export_id`)
  - [ ] Export includes vertex cache optimization (ACMR improvement)

---

### FR-005: User Authentication & Authorization

- **Priority**: HIGH
- **Category**: Security
- **Description**: Supabase Auth with multiple sign-in methods. JWT-based sessions. Role-based access control.

- **Acceptance Criteria**:
  - [x] Email/password registration and login (Supabase Auth)
  - [x] OAuth: Google, GitHub (Supabase Auth)
  - [x] JWT access tokens (15min) + refresh tokens (7 days) (Supabase Auth)
  - [ ] Roles: user, admin, enterprise-admin
  - [x] API key CRUD (create, list, revoke) — Settings page + Supabase profiles
  - [ ] API keys encrypted at rest (AES-256)
  - [ ] Account deletion (GDPR Article 17)

---

### FR-006: Subscription & Billing

- **Priority**: HIGH
- **Category**: Business
- **Description**: Stripe-powered subscription management with **fully configurable pricing**. All plan names, prices, limits, and feature gates are set by the operator at deployment time via admin dashboard or environment variables. No dollar amounts are hardcoded in the codebase.

  **AGPL-3.0 Compliance Note**: Any third-party operator deploying this SaaS must publish their full service source code under AGPL-3.0, unless they hold a Commercial License.

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Projects | Configurable (default: 5) | Configurable (default: 100) | Unlimited |
| Preview resolution | Basic | Full | Maximum |
| Export formats | Basic (OBJ, STL) | All 15 | All 15 + custom |
| API calls/hour | Configurable (default: 100) | Configurable (default: 10,000) | Unlimited |
| Mesh resolution max | Configurable (default: 128^3) | Configurable (default: 512^3) | Configurable (default: 1024^3) |
| Text-to-3D | Configurable (default: 10/day) | Configurable (default: 500/day) | Unlimited |
| Collaboration | - | Configurable (default: 5 users) | Configurable (default: 50 users) |
| Support | Community | Priority | Dedicated |
| SSO | - | - | Yes |
| SLA | - | - | Configurable |

  **Pricing**: Set by operator. Stripe Products/Prices created via admin dashboard or Stripe API. The application reads plan configuration from database/environment, not from source code.

- **Acceptance Criteria**:
  - [x] Stripe Checkout works for all configured tiers (via `/api/stripe/checkout`)
  - [x] All plan prices, limits, and features are configurable (zero hardcoded amounts)
  - [ ] Admin dashboard for creating/editing plans and their Stripe Price IDs
  - [ ] Trial period duration is configurable (env var / admin setting)
  - [x] Plan upgrade/downgrade follows Stripe subscription lifecycle
  - [ ] Usage-based billing tracks compute hours (metered billing via Stripe)
  - [ ] Invoice history accessible in user dashboard
  - [x] Webhook handler for all Stripe subscription events (`/api/stripe/webhook`)

---

### FR-007: Project Management

- **Priority**: MEDIUM
- **Category**: Core
- **Description**: Full project lifecycle management with versioning and sharing.

- **Acceptance Criteria**:
  - [x] Create, rename projects (via Supabase + editor page)
  - [ ] Duplicate, archive, delete projects
  - [ ] Auto-save every 30 seconds or on significant changes
  - [ ] Version history: last 100 snapshots retained
  - [ ] Restore any previous version
  - [ ] Share via public link (read-only) or team invitation
  - [ ] Asset library: save/reuse SDF subtrees as components

---

### FR-008: Collaborative Editing

- **Priority**: MEDIUM
- **Category**: Collaboration
- **Description**: Real-time multi-user SDF tree editing using ALICE-SDF's `tree_diff` and `apply_patch` modules.

- **Acceptance Criteria**:
  - [x] WebSocket collaboration service with broadcast messaging (`/ws/collab/:session_id`)
  - [x] Session creation and participant tracking (`POST /api/v1/collab/sessions`)
  - [ ] Sync latency < 100ms between users (same region)
  - [ ] Up to 10 concurrent editors (Pro), 50 (Enterprise)
  - [ ] Cursor presence indicators with user avatar/color
  - [ ] Per-user undo/redo (independent stacks)
  - [ ] No data loss on simultaneous edits to different subtrees
  - [ ] Conflict notification for same-node edits

---

### FR-009: REST API

- **Priority**: MEDIUM
- **Category**: API
- **Description**: Comprehensive REST API for programmatic access.

- **Endpoint Groups** (18 LIVE endpoints):
  - `/api/v1/sdf/*` — Compile, eval, validate (`/compile`, `/eval`, `/validate`)
  - `/api/v1/mesh/*` — Mesh generation (`/generate`)
  - `/api/v1/shader/*` — WGSL/GLSL/HLSL transpilation (`/transpile`)
  - `/api/v1/asset/*` — Export and download (`/export`, `/formats`, `/download/:id`)
  - `/api/v1/ai/*` — Text-to-SDF generation (`/generate`, `/providers`, `/examples`)
  - `/api/v1/collab/*` — Collaboration sessions (`/sessions`, `/sessions/:id`)
  - `/api/v1/primitives` — List all SDF node types
  - `/health`, `/license` — System health and license info

- **Acceptance Criteria**:
  - [ ] OpenAPI 3.1 spec published at `/api-docs`
  - [ ] P95 response time < 200ms for read operations
  - [x] Rate limiting enforced per tier (token bucket in API Gateway)
  - [ ] SDK libraries: JavaScript/TypeScript, Python
  - [x] Comprehensive error codes (400, 401, 403, 404, 409, 413, 429, 500, 503)

---

### FR-010: WebSocket API

- **Priority**: MEDIUM
- **Category**: API
- **Description**: Real-time communication channels.

- **Channels**:
  - `editor:{project_id}` — SDF tree sync
  - `preview:{project_id}` — Preview frame streaming
  - `collab:{project_id}` — Presence and cursors

- **Acceptance Criteria**:
  - [ ] Connection established in < 500ms
  - [ ] Message delivery latency < 50ms (same region)
  - [ ] Automatic reconnection with exponential backoff
  - [ ] Heartbeat interval: 30 seconds

---

### FR-011: Agent-Assisted Modeling

- **Priority**: LOW
- **Category**: AI
- **Description**: OmniCreatorTemplate 3D agents provide automated assistance.

- **Acceptance Criteria**:
  - [ ] Mesh optimization suggestions within 3 seconds
  - [ ] Material recommendations based on shape analysis
  - [ ] User can accept/reject/modify all suggestions
  - [ ] Agent never modifies tree without explicit confirmation

---

### FR-012: Analytics Dashboard

- **Priority**: LOW
- **Category**: Business
- **Description**: Usage and performance monitoring.

- **Acceptance Criteria**:
  - [ ] Dashboard loads in < 2 seconds
  - [ ] Metrics: projects created, exports by format, API calls, compute hours
  - [ ] Time range filter: 7d, 30d, 90d, custom
  - [ ] CSV export of all metrics

---

### FR-013: Template Gallery

- **Priority**: LOW
- **Category**: Content
- **Description**: Pre-built SDF templates for common use cases.

- **Acceptance Criteria**:
  - [ ] 50+ templates at launch
  - [ ] Categories: architectural, mechanical, organic, abstract, game assets
  - [ ] Search by name, category, tags
  - [ ] "Use Template" creates a new project from template
  - [ ] Community submissions (moderated)

---

### FR-014: Terrain & Destruction

- **Priority**: LOW
- **Category**: Advanced
- **Description**: Advanced terrain and destruction systems from ALICE-SDF terrain/destruction modules.

- **Acceptance Criteria**:
  - [ ] Heightmap terrain (1024x1024) generates in < 10 seconds
  - [ ] Hydraulic erosion simulation with configurable parameters
  - [ ] Clipmap LOD for large terrains
  - [ ] Voronoi fracture produces watertight pieces
  - [ ] Procedural cave generation

---

### FR-015: Advanced Analysis

- **Priority**: LOW
- **Category**: Advanced
- **Description**: Mathematical analysis tools built on ALICE-SDF's autodiff, measure, and constraint modules.

- **Acceptance Criteria**:
  - [ ] Volume estimation within 1% accuracy (1M Monte Carlo samples)
  - [ ] Surface area estimation within 2% accuracy
  - [ ] Gradient/normal computation matches finite-difference within 0.1%
  - [ ] Hessian and mean curvature computation
  - [ ] Constraint solver converges in < 100 iterations
  - [ ] SDF-to-SDF collision detection

---

## Non-Functional Requirements

### NFR-001: Performance

- **Priority**: HIGH
- **Description**: System performance targets.

| Metric | Target | Condition |
|--------|--------|-----------|
| SDF evaluation (grid) | < 16ms | 256^3, SIMD 8-wide + Rayon |
| WebGPU preview | 60fps | 1080p, RTX 3060 / M1 |
| WebGPU preview (4K) | 30fps | 4K, RTX 3080 / M2 |
| Mesh generation (MC) | < 3s | 256^3 resolution |
| Mesh generation (DC) | < 5s | 256^3 resolution |
| API read response | P95 < 200ms | All GET endpoints |
| API write response | P95 < 500ms | All POST/PUT endpoints |
| Cold start to editor | < 5s | First load after login |
| WGSL shader compile | < 500ms | Tree up to 200 nodes |

- **Acceptance Criteria**:
  - [ ] All metrics verified on reference hardware via automated benchmarks
  - [ ] Performance regression tests in CI/CD

---

### NFR-002: Scalability

- **Priority**: HIGH
- **Description**: System must scale to support growing user base.

- **Acceptance Criteria**:
  - [ ] 10,000+ concurrent users supported
  - [ ] Horizontal pod autoscaling for SDF engine (CPU-based)
  - [ ] Database connection pooling (Supabase PgBouncer)
  - [ ] CDN-delivered static assets
  - [ ] No single points of failure

---

### NFR-003: Security

- **Priority**: HIGH
- **Description**: Security standards and compliance.

- **Acceptance Criteria**:
  - [ ] TLS 1.3 for all external connections
  - [ ] JWT with short-lived tokens (15min) + refresh rotation
  - [ ] API keys AES-256 encrypted at rest
  - [ ] OWASP Top 10 compliance verified
  - [ ] No secrets in source code or logs
  - [ ] SQL injection protection (parameterized queries)
  - [ ] XSS protection (Content Security Policy headers)
  - [ ] GDPR compliance (data export, deletion)

---

### NFR-004: Reliability

- **Priority**: MEDIUM
- **Description**: Availability and disaster recovery targets.

- **Acceptance Criteria**:
  - [ ] Uptime SLA: 99.9% (measured monthly)
  - [ ] Enterprise SLA: 99.95%
  - [ ] Automated health checks and failover
  - [ ] Daily database backups, 30-day retention
  - [ ] RPO (Recovery Point Objective): < 1 hour
  - [ ] RTO (Recovery Time Objective): < 4 hours

---

### NFR-005: Observability

- **Priority**: MEDIUM
- **Description**: Monitoring, logging, and alerting infrastructure.

- **Acceptance Criteria**:
  - [ ] ALICE-Semantic-Telemetry integration for all services
  - [ ] Structured JSON logging with correlation IDs
  - [ ] Distributed tracing (OpenTelemetry)
  - [ ] Real-time dashboards (Grafana)
  - [ ] Alerting: PagerDuty/Opsgenie integration
  - [ ] Error budget tracking (SLO-based)
