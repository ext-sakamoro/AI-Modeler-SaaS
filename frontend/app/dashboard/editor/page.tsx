'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSdfStore } from '@/lib/hooks/use-sdf-store';
import { sdfApi } from '@/lib/sdf/client';
import { createClient } from '@/lib/supabase/client';
import type { SdfTree } from '@/lib/sdf/client';

export default function EditorPage() {
  const searchParams = useSearchParams();
  const {
    projectId, setProjectId, projectName, setProjectName,
    tree, setTree, isCompiling, setCompiling,
    isGeneratingMesh, setGeneratingMesh, meshData, setMeshData,
    shaderSource, setShaderSource, error, setError,
  } = useSdfStore();

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [jsonInput, setJsonInput] = useState(JSON.stringify(tree, null, 2));
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const loadProject = useCallback(async (id: string) => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, sdf_tree')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;
      if (data) {
        setProjectId(data.id);
        setProjectName(data.name);
        const sdfTree = data.sdf_tree as SdfTree;
        setTree(sdfTree);
        setJsonInput(JSON.stringify(sdfTree, null, 2));
      }
    } catch {
      // Project not found or Supabase not configured
    }
  }, [setProjectId, setProjectName, setTree]);

  useEffect(() => {
    const id = searchParams.get('project');
    if (id && id !== projectId) {
      loadProject(id);
    }
  }, [searchParams, projectId, loadProject]);

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase
        .from('projects')
        .update({ name: projectName, sdf_tree: tree, updated_at: new Date().toISOString() })
        .eq('id', projectId);
      if (saveError) throw saveError;
      setLastSaved(new Date().toLocaleTimeString());
    } catch {
      setError('Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  const handleTextTo3D = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await sdfApi.textTo3D(prompt);
      setTree(result.sdf_tree);
      setJsonInput(JSON.stringify(result.sdf_tree, null, 2));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompile = async () => {
    setCompiling(true);
    setError(null);
    try {
      const result = await sdfApi.compile(tree);
      if (!result.success) {
        setError('Compilation failed');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Compile failed');
    } finally {
      setCompiling(false);
    }
  };

  const handleGenerateMesh = async () => {
    setGeneratingMesh(true);
    setError(null);
    try {
      const result = await sdfApi.generateMesh(tree, 128, 'obj');
      setMeshData(result.data_text || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mesh generation failed');
    } finally {
      setGeneratingMesh(false);
    }
  };

  const handleTranspileShader = async () => {
    setError(null);
    try {
      const result = await sdfApi.transpileShader(tree, 'wgsl');
      setShaderSource(result.source);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Shader transpilation failed');
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonInput(value);
    try {
      const parsed = JSON.parse(value) as SdfTree;
      setTree(parsed);
      setError(null);
    } catch {
      // Don't set error while user is typing
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-2 flex items-center gap-2">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="text-sm font-semibold mr-2 bg-transparent border-none outline-none w-40 hover:bg-accent px-1 py-0.5 rounded"
        />
        {projectId && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-accent text-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
        {lastSaved && (
          <span className="text-xs text-muted-foreground">Saved {lastSaved}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleCompile}
          disabled={isCompiling}
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isCompiling ? 'Compiling...' : 'Compile'}
        </button>
        <button
          onClick={handleGenerateMesh}
          disabled={isGeneratingMesh}
          className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {isGeneratingMesh ? 'Generating...' : 'Generate Mesh'}
        </button>
        <button
          onClick={handleTranspileShader}
          className="px-3 py-1 bg-secondary text-secondary-foreground rounded text-xs font-medium hover:opacity-90"
        >
          WGSL Shader
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-2">{error}</div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Text-to-3D + Node Tree */}
        <div className="w-80 border-r border-border flex flex-col">
          {/* Text-to-3D */}
          <div className="p-4 border-b border-border space-y-2">
            <h2 className="text-sm font-semibold">Text-to-3D</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe a 3D shape..."
              className="w-full h-20 px-3 py-2 border border-input rounded-md bg-background text-sm resize-none"
            />
            <button
              onClick={handleTextTo3D}
              disabled={isGenerating || !prompt.trim()}
              className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate SDF'}
            </button>
          </div>

          {/* JSON Editor */}
          <div className="flex-1 p-4 overflow-auto">
            <h2 className="text-sm font-semibold mb-2">SDF Tree (JSON)</h2>
            <textarea
              value={jsonInput}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full h-full min-h-[300px] px-3 py-2 border border-input rounded-md bg-background text-xs font-mono resize-none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Center: 3D Viewport */}
        <div className="flex-1 flex items-center justify-center bg-muted/50">
          <div className="text-center text-muted-foreground space-y-2">
            <div className="text-6xl">3D</div>
            <p className="text-sm">
              WebGPU Viewport
              <br />
              (Requires WebGPU-enabled browser)
            </p>
            <p className="text-xs">
              Current: {tree.type}
              {tree.params && ` (${Object.entries(tree.params).map(([k, v]) => `${k}=${v}`).join(', ')})`}
            </p>
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="w-80 border-l border-border flex flex-col">
          {shaderSource && (
            <div className="flex-1 p-4 overflow-auto">
              <h2 className="text-sm font-semibold mb-2">WGSL Shader</h2>
              <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-auto max-h-96">
                {shaderSource}
              </pre>
            </div>
          )}
          {meshData && (
            <div className="flex-1 p-4 overflow-auto border-t border-border">
              <h2 className="text-sm font-semibold mb-2">Mesh Output (OBJ)</h2>
              <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-auto max-h-96">
                {meshData.substring(0, 2000)}
                {meshData.length > 2000 ? '\n... (truncated)' : ''}
              </pre>
            </div>
          )}
          {!shaderSource && !meshData && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
              Compile and generate mesh or shader to see output here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
