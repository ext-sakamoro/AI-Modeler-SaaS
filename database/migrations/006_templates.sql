-- 006_templates.sql
-- Template gallery for pre-built SDF models.

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  sdf_tree JSONB NOT NULL,
  thumbnail_url TEXT,
  difficulty TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_category ON public.templates(category);
CREATE INDEX idx_templates_featured ON public.templates(is_featured) WHERE is_featured = true;
