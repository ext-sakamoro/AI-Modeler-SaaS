# AI Modeler SaaS — Deployment Specification

## Document Info

- **Version**: 1.1.0
- **Created**: 2026-02-23
- **Updated**: 2026-02-23
- **Status**: Core Implemented
- **License**: AGPL-3.0 (public) + Commercial License (proprietary)

---

## Design Principle

> **"git clone → env → deploy" in under 60 seconds.**
>
> Any developer should be able to run the full AI Modeler SaaS stack locally or deploy to production with a single command. No manual service wiring, no multi-page setup guides.

---

## Quick Start (60-Second Local Deploy)

```bash
# 1. Clone
git clone https://github.com/ext-sakamoro/AI-Modeler-SaaS.git
cd AI-Modeler-SaaS

# 2. Configure (copy and edit)
cp .env.example .env
# Edit .env: set SUPABASE_URL, STRIPE_SECRET_KEY, ANTHROPIC_API_KEY (minimum)

# 3. Deploy
docker compose up -d

# Done. Open http://localhost:3000
```

**What happens**:
- Docker Compose builds and starts all 8 services
- SDF Engine (Rust) compiles in release mode inside a multi-stage Docker build
- Frontend (Next.js 15) starts in production mode
- Supabase local dev stack starts (PostgreSQL + Auth + Storage + Realtime)
- All services are health-checked and interconnected via internal network
- Seed data (50+ templates) is automatically loaded on first boot

---

## Docker Compose Architecture

### Service Topology

```
┌─────────────────────────────────────────────────────────┐
│  docker compose up -d                                    │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  frontend    │  │  api-gateway │  │  sdf-engine     │ │
│  │  Next.js 15  │  │  Rust/Axum  │  │  Rust Native    │ │
│  │  :3000       │  │  :8080      │  │  :8081          │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                    │          │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌────────┴────────┐ │
│  │  collab-svc  │  │  asset-svc  │  │  ai-llm-svc    │ │
│  │  WebSocket   │  │  Export     │  │  Text-to-3D    │ │
│  │  :8083       │  │  :8084      │  │  :8082         │ │
│  └─────────────┘  └─────────────┘  └────────────────┘ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  supabase (local dev stack)                          │ │
│  │  ├─ postgres    :5432  (PostgreSQL 15)               │ │
│  │  ├─ auth        :9999  (GoTrue)                      │ │
│  │  ├─ storage     :5000  (S3-compatible)               │ │
│  │  ├─ realtime    :4000  (Phoenix channels)            │ │
│  │  ├─ meta        :8080  (Metadata API)                │ │
│  │  └─ studio      :3001  (Supabase Studio UI)          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─────────────┐                                        │
│  │  redis       │  (rate limiting, session cache)        │
│  │  :6379       │                                        │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

### docker-compose.yml Specification

```yaml
version: "3.9"

x-common-env: &common-env
  SUPABASE_URL: ${SUPABASE_URL:-http://supabase-kong:8000}
  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
  SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY}
  REDIS_URL: ${REDIS_URL:-redis://redis:6379}
  LOG_LEVEL: ${LOG_LEVEL:-info}
  LICENSE_MODE: ${LICENSE_MODE:-agpl}

services:
  # ── Frontend ───────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:-http://localhost:8000}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:8080}
        NEXT_PUBLIC_WS_URL: ${NEXT_PUBLIC_WS_URL:-ws://localhost:8083}
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    environment:
      <<: *common-env
    depends_on:
      api-gateway:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── API Gateway ────────────────────────────────────────
  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    ports:
      - "${API_GATEWAY_PORT:-8080}:8080"
    environment:
      <<: *common-env
      SDF_ENGINE_URL: http://sdf-engine:8081
      ASSET_SERVICE_URL: http://asset-svc:8084
      AI_LLM_SERVICE_URL: http://ai-llm-svc:8082
      COLLAB_SERVICE_URL: http://collab-svc:8083
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
    depends_on:
      sdf-engine:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── SDF Engine (Rust) ─────────────────────────────────
  sdf-engine:
    build:
      context: ./services/sdf-engine
      dockerfile: Dockerfile
      # Multi-stage: cargo build --release in builder, copy binary to slim runtime
    ports:
      - "${SDF_ENGINE_PORT:-8081}:8081"
    environment:
      <<: *common-env
      RUST_LOG: ${RUST_LOG:-alice_sdf=info}
      SIMD_WIDTH: ${SIMD_WIDTH:-auto}
      RAYON_NUM_THREADS: ${RAYON_NUM_THREADS:-0}
    deploy:
      resources:
        limits:
          cpus: "${SDF_ENGINE_CPUS:-2.0}"
          memory: ${SDF_ENGINE_MEMORY:-1G}
        reservations:
          cpus: "1.0"
          memory: 512M
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── Collaboration Service (WebSocket) ──────────────────
  collab-svc:
    build:
      context: ./services/collab
      dockerfile: Dockerfile
    ports:
      - "${COLLAB_PORT:-8083}:8083"
    environment:
      <<: *common-env
    depends_on:
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8083/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── Asset Service (Export / Mesh Gen) ──────────────────
  asset-svc:
    build:
      context: ./services/asset
      dockerfile: Dockerfile
    ports:
      - "${ASSET_PORT:-8084}:8084"
    environment:
      <<: *common-env
      SDF_ENGINE_URL: http://sdf-engine:8081
      EXPORT_STORAGE_PATH: /data/exports
    volumes:
      - export-data:/data/exports
    depends_on:
      sdf-engine:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8084/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── AI/LLM Service (Text-to-3D) ───────────────────────
  ai-llm-svc:
    build:
      context: ./services/ai-llm
      dockerfile: Dockerfile
    ports:
      - "${AI_LLM_PORT:-8082}:8082"
    environment:
      <<: *common-env
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      GOOGLE_AI_API_KEY: ${GOOGLE_AI_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LLM_PRIMARY_PROVIDER: ${LLM_PRIMARY_PROVIDER:-anthropic}
      SDF_ENGINE_URL: http://sdf-engine:8081
    depends_on:
      sdf-engine:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8082/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ── Redis (Rate Limiting + Session Cache) ──────────────
  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  # ── Supabase Local Dev Stack ───────────────────────────
  # When SUPABASE_MODE=cloud, this service is not started.
  # The application connects to Supabase Cloud instead.
  supabase-db:
    image: supabase/postgres:15.6.1.143
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ai_modeler
    volumes:
      - supabase-db-data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    profiles:
      - local  # Only started with: docker compose --profile local up
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  supabase-db-data:
    driver: local
  redis-data:
    driver: local
  export-data:
    driver: local

networks:
  default:
    name: ai-modeler-network
```

### Dockerfile Specifications

#### SDF Engine (Multi-Stage Rust Build)

```dockerfile
# ── Builder Stage ────────────────────────────────────────
FROM rust:1.77-slim-bookworm AS builder

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ ./src/

# Release build with full optimizations
RUN cargo build --release \
    --features "gpu,glsl,hlsl,ffi" \
    && strip target/release/sdf-engine

# ── Runtime Stage ────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/sdf-engine /usr/local/bin/sdf-engine

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8081/health || exit 1

ENTRYPOINT ["sdf-engine"]
```

**Build optimizations**:
- Multi-stage build: builder ~2GB → runtime ~80MB
- `strip` removes debug symbols
- Release profile: `opt-level=3, lto=fat, codegen-units=1, panic=abort`

#### Frontend (Next.js 15)

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

---

## Helm Chart Architecture

### Chart Structure

```
charts/ai-modeler/
├── Chart.yaml                    # Chart metadata
├── values.yaml                   # Default configuration
├── values-aws.yaml               # AWS EKS overrides
├── values-gcp.yaml               # GCP GKE overrides
├── values-azure.yaml             # Azure AKS overrides
├── templates/
│   ├── _helpers.tpl              # Template helpers
│   ├── namespace.yaml            # Namespace definition
│   ├── configmap.yaml            # Shared configuration
│   ├── secret.yaml               # Encrypted secrets
│   │
│   ├── frontend/
│   │   ├── deployment.yaml       # Next.js pods
│   │   ├── service.yaml          # ClusterIP service
│   │   └── hpa.yaml              # Horizontal Pod Autoscaler
│   │
│   ├── api-gateway/
│   │   ├── deployment.yaml       # API Gateway pods
│   │   ├── service.yaml          # ClusterIP service
│   │   └── hpa.yaml
│   │
│   ├── sdf-engine/
│   │   ├── deployment.yaml       # SDF Engine pods (CPU-intensive)
│   │   ├── service.yaml          # ClusterIP service
│   │   ├── hpa.yaml              # CPU-based autoscaler (2-16 replicas)
│   │   └── pdb.yaml              # PodDisruptionBudget (minAvailable: 1)
│   │
│   ├── collab/
│   │   ├── deployment.yaml       # WebSocket pods
│   │   └── service.yaml
│   │
│   ├── asset/
│   │   ├── deployment.yaml       # Asset service pods
│   │   ├── service.yaml
│   │   └── pvc.yaml              # Persistent volume for exports
│   │
│   ├── ai-llm/
│   │   ├── deployment.yaml       # AI/LLM pods
│   │   └── service.yaml
│   │
│   ├── redis/
│   │   ├── deployment.yaml       # Redis pod
│   │   ├── service.yaml
│   │   └── pvc.yaml              # Persistent volume
│   │
│   ├── ingress.yaml              # Ingress (nginx / Cloudflare / ALB)
│   ├── certificate.yaml          # TLS certificate (cert-manager)
│   └── networkpolicy.yaml        # Network isolation rules
│
└── tests/
    └── test-connection.yaml      # Helm test: verify all services respond
```

### Chart.yaml

```yaml
apiVersion: v2
name: ai-modeler
description: AI Modeler SaaS — ALICE-SDF Cloud Platform
type: application
version: 1.1.0
appVersion: "1.1.0"
keywords:
  - sdf
  - 3d-modeling
  - saas
  - webgpu
  - text-to-3d
home: https://github.com/ext-sakamoro/AI-Modeler-SaaS
sources:
  - https://github.com/ext-sakamoro/AI-Modeler-SaaS
maintainers:
  - name: Moroya Sakamoto
```

### values.yaml (Defaults)

```yaml
global:
  license: agpl-3.0  # agpl-3.0 | commercial
  domain: ai-modeler.localhost
  tls: false  # Set true for production

# ── Frontend ─────────────────────────────────────────────
frontend:
  replicaCount: 2
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-frontend
    tag: latest
  resources:
    requests: { cpu: 250m, memory: 256Mi }
    limits:   { cpu: 500m, memory: 512Mi }
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 4
    targetCPU: 70

# ── API Gateway ──────────────────────────────────────────
apiGateway:
  replicaCount: 2
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-api-gateway
    tag: latest
  resources:
    requests: { cpu: 250m, memory: 128Mi }
    limits:   { cpu: 500m, memory: 256Mi }

# ── SDF Engine ───────────────────────────────────────────
sdfEngine:
  replicaCount: 2
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-sdf-engine
    tag: latest
  resources:
    requests: { cpu: 1000m, memory: 512Mi }
    limits:   { cpu: 2000m, memory: 1Gi }
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 16
    targetCPU: 70
  env:
    RAYON_NUM_THREADS: "0"  # auto-detect
    SIMD_WIDTH: "auto"

# ── Collaboration ────────────────────────────────────────
collab:
  replicaCount: 2
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-collab
    tag: latest
  resources:
    requests: { cpu: 250m, memory: 128Mi }
    limits:   { cpu: 500m, memory: 256Mi }

# ── Asset Service ────────────────────────────────────────
asset:
  replicaCount: 1
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-asset
    tag: latest
  resources:
    requests: { cpu: 500m, memory: 256Mi }
    limits:   { cpu: 1000m, memory: 512Mi }
  persistence:
    enabled: true
    size: 50Gi
    storageClass: ""  # Use default

# ── AI/LLM Service ──────────────────────────────────────
aiLlm:
  replicaCount: 1
  image:
    repository: ghcr.io/ext-sakamoro/ai-modeler-ai-llm
    tag: latest
  resources:
    requests: { cpu: 250m, memory: 256Mi }
    limits:   { cpu: 500m, memory: 512Mi }

# ── Redis ────────────────────────────────────────────────
redis:
  enabled: true  # Set false to use external Redis (e.g., ElastiCache)
  image: redis:7-alpine
  resources:
    requests: { cpu: 100m, memory: 128Mi }
    limits:   { cpu: 250m, memory: 256Mi }
  persistence:
    enabled: true
    size: 1Gi

# ── Ingress ──────────────────────────────────────────────
ingress:
  enabled: true
  className: nginx  # nginx | alb | cloudflare
  annotations: {}
  tls: []

# ── External Services (Secrets) ──────────────────────────
# These are set via --set or values override files, NEVER in values.yaml
externalSecrets:
  supabaseUrl: ""
  supabaseAnonKey: ""
  supabaseServiceKey: ""
  stripeSecretKey: ""
  stripeWebhookSecret: ""
  anthropicApiKey: ""
  googleAiApiKey: ""
  openaiApiKey: ""
```

### Deploy Commands

```bash
# Local development (Minikube / Docker Desktop K8s)
helm install ai-modeler ./charts/ai-modeler \
  -f values.yaml \
  --set externalSecrets.supabaseUrl="http://..." \
  --set externalSecrets.stripeSecretKey="sk_test_..."

# AWS EKS
helm install ai-modeler ./charts/ai-modeler \
  -f values.yaml \
  -f values-aws.yaml \
  --set global.domain="ai-modeler.example.com" \
  --set global.tls=true

# GCP GKE
helm install ai-modeler ./charts/ai-modeler \
  -f values.yaml \
  -f values-gcp.yaml \
  --set global.domain="ai-modeler.example.com"

# Azure AKS
helm install ai-modeler ./charts/ai-modeler \
  -f values.yaml \
  -f values-azure.yaml \
  --set global.domain="ai-modeler.example.com"
```

---

## One-Click Deploy Buttons

### Supported Platforms

| Platform | Method | Estimated Time | Cost |
|----------|--------|---------------|------|
| **Railway** | Deploy button (1 click) | ~3 minutes | From $5/mo |
| **Render** | Deploy button (1 click) | ~5 minutes | From $7/mo |
| **DigitalOcean App Platform** | Deploy button (1 click) | ~5 minutes | From $12/mo |
| **Vercel + External Backend** | Deploy button (frontend only) | ~2 minutes | Free tier available |
| **Docker Compose (local)** | `docker compose up -d` | ~2 minutes | Free |
| **Helm (any K8s)** | `helm install` | ~3 minutes | Depends on cluster |

### Railway Deploy Button

README.md includes:

```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/ai-modeler-saas)
```

**railway.json**:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "startCommand": "docker compose up",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Render Deploy Button

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ext-sakamoro/AI-Modeler-SaaS)
```

**render.yaml** (Blueprint):
```yaml
services:
  # Frontend
  - type: web
    name: ai-modeler-frontend
    runtime: docker
    dockerfilePath: ./frontend/Dockerfile
    envVars:
      - key: NEXT_PUBLIC_API_URL
        fromService:
          name: ai-modeler-api
          type: web
          property: host

  # API Gateway
  - type: web
    name: ai-modeler-api
    runtime: docker
    dockerfilePath: ./services/api-gateway/Dockerfile
    envVars:
      - key: SDF_ENGINE_URL
        fromService:
          name: ai-modeler-sdf-engine
          type: pserv
          property: hostport

  # SDF Engine (private service — not internet-exposed)
  - type: pserv
    name: ai-modeler-sdf-engine
    runtime: docker
    dockerfilePath: ./services/sdf-engine/Dockerfile

  # Redis
  - type: redis
    name: ai-modeler-redis
    plan: starter
    maxmemoryPolicy: allkeys-lru

databases:
  - name: ai-modeler-db
    plan: starter
    databaseName: ai_modeler
    postgresMajorVersion: "15"
```

### DigitalOcean App Platform

```markdown
[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/ext-sakamoro/AI-Modeler-SaaS/tree/main)
```

### Vercel (Frontend Only)

```markdown
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ext-sakamoro/AI-Modeler-SaaS&root-directory=frontend)
```

Note: Vercel deploys the Next.js frontend only. Backend services (SDF Engine, API Gateway, etc.) must be deployed separately on another platform.

---

## Cloud Provider-Specific Guides

### AWS (EKS + ECR + RDS)

```bash
# Prerequisites: aws-cli, eksctl, kubectl, helm

# 1. Create EKS cluster
eksctl create cluster \
  --name ai-modeler \
  --region us-west-2 \
  --nodegroup-name sdf-nodes \
  --node-type c6i.xlarge \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 8

# 2. Install ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx

# 3. Deploy AI Modeler
helm install ai-modeler ./charts/ai-modeler \
  -f values-aws.yaml \
  --set global.domain="ai-modeler.example.com" \
  --set global.tls=true \
  --set ingress.className=nginx \
  --set-file externalSecrets.supabaseUrl=<(aws ssm get-parameter --name /ai-modeler/supabase-url --query Parameter.Value --output text)
```

**values-aws.yaml**:
```yaml
global:
  cloud: aws

sdfEngine:
  hpa:
    maxReplicas: 16
  nodeSelector:
    node.kubernetes.io/instance-type: c6i.xlarge  # Compute-optimized

asset:
  persistence:
    storageClass: gp3  # AWS EBS gp3

ingress:
  className: nginx
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-scheme: internet-facing
```

### Google Cloud (GKE + Artifact Registry)

```bash
# 1. Create GKE cluster
gcloud container clusters create ai-modeler \
  --zone us-central1-a \
  --machine-type c2-standard-4 \
  --num-nodes 3 \
  --min-nodes 2 \
  --max-nodes 8 \
  --enable-autoscaling

# 2. Deploy
helm install ai-modeler ./charts/ai-modeler \
  -f values-gcp.yaml \
  --set global.domain="ai-modeler.example.com"
```

**values-gcp.yaml**:
```yaml
global:
  cloud: gcp

sdfEngine:
  nodeSelector:
    cloud.google.com/machine-family: c2  # Compute-optimized

asset:
  persistence:
    storageClass: premium-rwo  # GCP SSD

ingress:
  className: gce
  annotations:
    kubernetes.io/ingress.global-static-ip-name: ai-modeler-ip
```

### Azure (AKS + ACR)

```bash
# 1. Create AKS cluster
az aks create \
  --resource-group ai-modeler-rg \
  --name ai-modeler \
  --node-vm-size Standard_F4s_v2 \
  --node-count 3 \
  --min-count 2 \
  --max-count 8 \
  --enable-cluster-autoscaler

# 2. Deploy
helm install ai-modeler ./charts/ai-modeler \
  -f values-azure.yaml \
  --set global.domain="ai-modeler.example.com"
```

**values-azure.yaml**:
```yaml
global:
  cloud: azure

sdfEngine:
  nodeSelector:
    agentpool: compute  # Dedicated compute node pool

asset:
  persistence:
    storageClass: managed-premium  # Azure Premium SSD

ingress:
  className: azure-application-gateway
```

---

## Environment Variable Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJ...` |
| `STRIPE_SECRET_KEY` | Stripe API secret key | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

### Required (At Least One LLM Provider)

| Variable | Description | Example |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |
| `GOOGLE_AI_API_KEY` | Google Generative AI key | `AIza...` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### Optional — Service Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | `3000` | Frontend port |
| `API_GATEWAY_PORT` | `8080` | API Gateway port |
| `SDF_ENGINE_PORT` | `8081` | SDF Engine port |
| `COLLAB_PORT` | `8083` | Collaboration WebSocket port |
| `ASSET_PORT` | `8084` | Asset service port |
| `AI_LLM_PORT` | `8082` | AI/LLM service port |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `LOG_LEVEL` | `info` | Log level (trace/debug/info/warn/error) |
| `RUST_LOG` | `alice_sdf=info` | Rust log filter |

### Optional — SDF Engine Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMD_WIDTH` | `auto` | SIMD width override (`auto`, `8` for AVX2, `4` for NEON, `1` for scalar) |
| `RAYON_NUM_THREADS` | `0` | Rayon thread count (`0` = auto-detect all cores) |
| `SDF_ENGINE_CPUS` | `2.0` | Docker CPU limit for SDF Engine |
| `SDF_ENGINE_MEMORY` | `1G` | Docker memory limit for SDF Engine |
| `MESH_CACHE_SIZE_MB` | `256` | Mesh evaluation cache size |
| `MAX_TREE_NODES` | `1000` | Maximum SDF tree node count per request |
| `MAX_MESH_RESOLUTION` | `512` | Maximum mesh grid resolution |

### Optional — LLM Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PRIMARY_PROVIDER` | `anthropic` | Primary LLM provider (`anthropic`, `google`, `openai`) |
| `LLM_TIMEOUT_SEC` | `30` | LLM request timeout |
| `LLM_MAX_RETRIES` | `2` | Max retry attempts on LLM failure |
| `TEXT_TO_3D_MAX_NODES` | `200` | Maximum nodes in LLM-generated SDF tree |

### Optional — Billing Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BILLING_ENABLED` | `true` | Enable/disable Stripe billing |
| `FREE_TRIAL_DAYS` | `14` | Free trial duration for Pro tier |
| `PLAN_CONFIG_SOURCE` | `database` | Plan config source (`database`, `env`, `static`) |
| `DEFAULT_PLAN` | `free` | Default plan for new users |

### Optional — License

| Variable | Default | Description |
|----------|---------|-------------|
| `LICENSE_MODE` | `agpl` | License mode (`agpl` or `commercial`) |
| `LICENSE_KEY` | `` | Commercial license key (required if LICENSE_MODE=commercial) |

---

## .env.example

```bash
# ================================================================
# AI Modeler SaaS — Environment Configuration
# ================================================================
# Copy this file to .env and fill in your values.
# For local development, only SUPABASE and one LLM key are needed.
# ================================================================

# ── License ──────────────────────────────────────────────
LICENSE_MODE=agpl
# LICENSE_KEY=  # Set if LICENSE_MODE=commercial

# ── Supabase (Required) ─────────────────────────────────
SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
# POSTGRES_PASSWORD=postgres  # Only for local Supabase

# ── Stripe (Required for billing) ───────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
# BILLING_ENABLED=true
# FREE_TRIAL_DAYS=14

# ── LLM Providers (at least one required) ───────────────
ANTHROPIC_API_KEY=sk-ant-...
# GOOGLE_AI_API_KEY=
# OPENAI_API_KEY=
# LLM_PRIMARY_PROVIDER=anthropic

# ── Service URLs (auto-configured in Docker Compose) ────
# NEXT_PUBLIC_API_URL=http://localhost:8080
# NEXT_PUBLIC_WS_URL=ws://localhost:8083

# ── SDF Engine Tuning ────────────────────────────────────
# SIMD_WIDTH=auto
# RAYON_NUM_THREADS=0
# SDF_ENGINE_CPUS=2.0
# SDF_ENGINE_MEMORY=1G

# ── Logging ──────────────────────────────────────────────
# LOG_LEVEL=info
# RUST_LOG=alice_sdf=info
```

---

## CI/CD Pipeline (GitHub Actions)

### Workflow: Build, Test, Deploy

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  # ── Test ─────────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Test SDF Engine
        run: |
          cd services/sdf-engine
          cargo test --release
          cargo clippy -- -W clippy::pedantic

      - name: Test Frontend
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          pnpm test
          pnpm build

  # ── Build & Push Images ──────────────────────────────
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service: [frontend, api-gateway, sdf-engine, collab, asset, ai-llm]
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        uses: docker/build-push-action@v5
        with:
          context: ./services/${{ matrix.service }}
          push: true
          tags: ghcr.io/${{ github.repository }}/${{ matrix.service }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ── Deploy to Production ─────────────────────────────
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via Helm
        run: |
          helm upgrade --install ai-modeler ./charts/ai-modeler \
            --set global.image.tag=${{ github.sha }} \
            --set global.domain=${{ vars.DOMAIN }} \
            --reuse-values
```

---

## Health Check & Smoke Test

### Post-Deploy Verification Script

```bash
#!/usr/bin/env bash
# scripts/smoke-test.sh — Run after deploy to verify all services
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"

echo "=== AI Modeler SaaS Smoke Test ==="

# 1. API Gateway health
echo -n "API Gateway... "
curl -sf "$BASE_URL/health" | jq -r '.status' | grep -q "ok" && echo "OK" || echo "FAIL"

# 2. SDF Engine compile
echo -n "SDF Engine compile... "
COMPILED=$(curl -sf -X POST "$BASE_URL/v1/engine/compile" \
  -H "Content-Type: application/json" \
  -d '{"tree": {"Sphere": {"radius": 1.0}}}' | jq -r '.compiled_id')
[ -n "$COMPILED" ] && echo "OK (id=$COMPILED)" || echo "FAIL"

# 3. SDF Engine eval
echo -n "SDF Engine eval... "
DIST=$(curl -sf -X POST "$BASE_URL/v1/engine/eval" \
  -H "Content-Type: application/json" \
  -d "{\"compiled_id\": \"$COMPILED\", \"points\": [[0,0,0]]}" | jq -r '.distances[0]')
echo "OK (distance=$DIST)"

# 4. Mesh generation
echo -n "Mesh generation... "
MESH=$(curl -sf -X POST "$BASE_URL/v1/mesh/generate" \
  -H "Content-Type: application/json" \
  -d "{\"compiled_id\": \"$COMPILED\", \"method\": \"marching_cubes\", \"resolution\": 32}" | jq -r '.mesh_id')
[ -n "$MESH" ] && echo "OK (id=$MESH)" || echo "FAIL"

# 5. WGSL shader transpile
echo -n "WGSL transpile... "
SHADER_SIZE=$(curl -sf -X POST "$BASE_URL/v1/shader/wgsl" \
  -H "Content-Type: application/json" \
  -d "{\"compiled_id\": \"$COMPILED\"}" | jq -r '.source_size_bytes')
echo "OK (${SHADER_SIZE} bytes)"

# 6. Frontend
echo -n "Frontend... "
curl -sf "http://localhost:3000" > /dev/null && echo "OK" || echo "FAIL"

echo "=== Smoke Test Complete ==="
```

---

## Migration & Seed Data

### Database Migration (On First Boot)

```
database/migrations/
├── 001_users.sql                       # User profiles, extensions, RLS
├── 002_projects.sql                    # Projects table + indexes
├── 003_sdf_trees.sql                   # SDF tree version history
├── 004_exports.sql                     # Exported assets tracking
├── 005_plan_configs.sql                # Configurable plan limits
├── 006_templates.sql                   # Template gallery
├── 007_api_usage.sql                   # API usage logging
├── 008_collab_sessions.sql             # Collaboration sessions
└── 009_functions.sql                   # Database functions
```

### Plan Config Seed (included in 005_plan_configs.sql)

```sql
-- Default plan configurations (operator can modify via admin dashboard)
INSERT INTO plan_configs (tier, display_name, stripe_price_id, limits, features) VALUES
  ('free', 'Free', NULL, '{
    "max_projects": 5,
    "max_resolution": 128,
    "api_rate_per_hour": 100,
    "text_to_3d_per_day": 10,
    "collab_max_users": 0
  }', '["basic_primitives", "obj_export", "stl_export"]'),

  ('pro', 'Pro', NULL, '{
    "max_projects": 100,
    "max_resolution": 512,
    "api_rate_per_hour": 10000,
    "text_to_3d_per_day": 500,
    "collab_max_users": 5
  }', '["all_primitives", "all_formats", "api_access", "text_to_3d", "collaboration"]'),

  ('enterprise', 'Enterprise', NULL, '{
    "max_projects": -1,
    "max_resolution": 1024,
    "api_rate_per_hour": -1,
    "text_to_3d_per_day": -1,
    "collab_max_users": 50
  }', '["all_primitives", "all_formats", "api_access", "text_to_3d", "collaboration", "sso", "custom_deployment", "sla"]');

-- NOTE: stripe_price_id is NULL by default.
-- Operator must create Stripe Products/Prices and update these rows
-- via admin dashboard or direct SQL.
```

---

## Summary

| Deploy Method | Command | Time | Target |
|--------------|---------|------|--------|
| **Local (Docker Compose)** | `docker compose up -d` | ~2 min | Development, testing |
| **Helm (any K8s)** | `helm install ai-modeler ./charts/ai-modeler` | ~3 min | Production |
| **AWS EKS** | `helm install -f values-aws.yaml` | ~5 min | Production (AWS) |
| **GCP GKE** | `helm install -f values-gcp.yaml` | ~5 min | Production (GCP) |
| **Azure AKS** | `helm install -f values-azure.yaml` | ~5 min | Production (Azure) |
| **Railway** | Click deploy button | ~3 min | Quick demo / staging |
| **Render** | Click deploy button | ~5 min | Quick demo / staging |
| **DigitalOcean** | Click deploy button | ~5 min | Quick demo / staging |
| **Vercel** | Click deploy button (frontend only) | ~2 min | Frontend preview |

All methods result in a fully functional AI Modeler SaaS instance with:
- Real-time WebGPU SDF preview
- Text-to-3D generation
- 15-format export
- Stripe billing (configurable pricing)
- AGPL-3.0 license compliance
