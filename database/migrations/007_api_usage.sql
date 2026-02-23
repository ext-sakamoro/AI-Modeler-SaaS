-- 007_api_usage.sql
-- API usage tracking for rate limiting and analytics.

CREATE TABLE public.api_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_usage_user_time ON public.api_usage(user_id, created_at DESC);

-- Partition by month for performance (optional, can be added later)
