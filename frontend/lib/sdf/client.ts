/**
 * SDF API client for communicating with the backend services.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export interface SdfTree {
  type: string;
  params?: Record<string, unknown>;
  a?: SdfTree;
  b?: SdfTree;
  child?: SdfTree;
  children?: SdfTree[];
}

export interface CompileResult {
  success: boolean;
  node_count: number;
  depth: number;
  compile_time_ms: number;
}

export interface EvalResult {
  distances: number[];
  eval_time_ms: number;
  point_count: number;
  mode: string;
}

export interface MeshResult {
  vertex_count: number;
  face_count: number;
  format: string;
  generation_time_ms: number;
  data_base64?: string;
  data_text?: string;
}

export interface ShaderResult {
  target: string;
  source: string;
  transpile_time_ms: number;
}

export interface GenerateResult {
  sdf_tree: SdfTree;
  provider: string;
  model: string;
  generation_time_ms: number;
  cached: boolean;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // Supabase not configured — fall through
  }
  return {};
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.details || res.statusText);
  }
  return res.json();
}

export const sdfApi = {
  compile: (tree: SdfTree) =>
    apiFetch<CompileResult>('/api/v1/sdf/compile', {
      method: 'POST', body: JSON.stringify({ tree }),
    }),

  eval: (tree: SdfTree, points: number[][]) =>
    apiFetch<EvalResult>('/api/v1/sdf/eval', {
      method: 'POST', body: JSON.stringify({ tree, points }),
    }),

  validate: (tree: SdfTree) =>
    apiFetch<{ valid: boolean; errors: string[] }>('/api/v1/sdf/validate', {
      method: 'POST', body: JSON.stringify({ tree }),
    }),

  generateMesh: (tree: SdfTree, resolution = 128, format = 'obj') =>
    apiFetch<MeshResult>('/api/v1/mesh/generate', {
      method: 'POST', body: JSON.stringify({ tree, resolution, format }),
    }),

  transpileShader: (tree: SdfTree, target = 'wgsl') =>
    apiFetch<ShaderResult>('/api/v1/shader/transpile', {
      method: 'POST', body: JSON.stringify({ tree, target }),
    }),

  export: (tree: SdfTree, format: string, resolution = 128) =>
    apiFetch<{ export_id: string; format: string; download_url: string }>('/api/v1/asset/export', {
      method: 'POST', body: JSON.stringify({ tree, format, resolution }),
    }),

  textTo3D: (prompt: string, provider = 'auto', quality = 'standard') =>
    apiFetch<GenerateResult>('/api/v1/ai/generate', {
      method: 'POST', body: JSON.stringify({ prompt, provider, quality }),
    }),

  listPrimitives: () =>
    apiFetch<{
      total: number;
      primitives: { name: string; category: string; params: unknown[] }[];
      operations: { name: string; category: string; params: unknown[] }[];
      transforms: { name: string; category: string; params: unknown[] }[];
      modifiers: { name: string; category: string; params: unknown[] }[];
    }>('/api/v1/primitives'),

  listFormats: () =>
    apiFetch<{
      total: number;
      formats: { name: string; extension: string; category: string; description: string }[];
    }>('/api/v1/asset/formats'),
};
