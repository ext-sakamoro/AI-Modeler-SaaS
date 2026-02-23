-- 005_plan_configs.sql
-- Operator-configurable plan limits. Pricing amounts are managed via Stripe, not here.

CREATE TABLE public.plan_configs (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free', 'pro', 'enterprise')),
  max_projects INTEGER NOT NULL,
  max_mesh_resolution INTEGER NOT NULL,
  api_calls_per_hour INTEGER NOT NULL,
  text_to_3d_per_day INTEGER NOT NULL,
  collab_max_users INTEGER NOT NULL,
  export_formats TEXT[] NOT NULL,
  stripe_price_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default seed data (pricing is set via Stripe, not here)
INSERT INTO public.plan_configs VALUES
  (
    'free',
    5,
    128,
    100,
    10,
    1,
    ARRAY['obj','stl'],
    NULL,
    now()
  ),
  (
    'pro',
    100,
    512,
    10000,
    500,
    5,
    ARRAY['obj','stl','glb','fbx','usd','alembic','ply','3mf','asdf','nanite','abm','wgsl','glsl','hlsl'],
    NULL,
    now()
  ),
  (
    'enterprise',
    -1,
    1024,
    -1,
    -1,
    50,
    ARRAY['obj','stl','glb','fbx','usd','alembic','ply','3mf','asdf','nanite','abm','wgsl','glsl','hlsl'],
    NULL,
    now()
  );
