-- 003_sdf_trees.sql
-- SDF tree version history per project.

CREATE TABLE public.sdf_tree_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  sdf_tree JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, version)
);

CREATE INDEX idx_sdf_versions_project ON public.sdf_tree_versions(project_id, version DESC);
