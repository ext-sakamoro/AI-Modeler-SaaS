'use client';

import { useState } from 'react';
import { useSdfStore } from '@/lib/hooks/use-sdf-store';
import { sdfApi } from '@/lib/sdf/client';

const FORMATS = [
  { ext: 'obj', name: 'OBJ', category: 'mesh' },
  { ext: 'stl', name: 'STL', category: 'mesh' },
  { ext: 'glb', name: 'GLB', category: 'mesh' },
  { ext: 'fbx', name: 'FBX', category: 'mesh' },
  { ext: 'usd', name: 'USD', category: 'mesh' },
  { ext: 'ply', name: 'PLY', category: 'mesh' },
  { ext: '3mf', name: '3MF', category: 'mesh' },
  { ext: 'wgsl', name: 'WGSL', category: 'shader' },
  { ext: 'glsl', name: 'GLSL', category: 'shader' },
  { ext: 'hlsl', name: 'HLSL', category: 'shader' },
];

export default function ExportPage() {
  const { tree } = useSdfStore();
  const [selectedFormat, setSelectedFormat] = useState('obj');
  const [resolution, setResolution] = useState(128);
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [shaderResult, setShaderResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDownloadUrl(null);
    setShaderResult(null);

    try {
      const format = FORMATS.find((f) => f.ext === selectedFormat);
      if (format?.category === 'shader') {
        const res = await sdfApi.transpileShader(tree, selectedFormat);
        setShaderResult(res.source);
      } else {
        const res = await sdfApi.export(tree, selectedFormat, resolution);
        setDownloadUrl(res.download_url);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadShader = () => {
    if (!shaderResult) return;
    const blob = new Blob([shaderResult], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export.${selectedFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Export</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">Format</label>
          <div className="grid grid-cols-5 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.ext}
                onClick={() => {
                  setSelectedFormat(f.ext);
                  setDownloadUrl(null);
                  setShaderResult(null);
                  setError(null);
                }}
                className={`px-3 py-2 rounded-md text-sm border ${
                  selectedFormat === f.ext
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>

        {FORMATS.find((f) => f.ext === selectedFormat)?.category === 'mesh' && (
          <div>
            <label className="text-sm font-medium block mb-2">
              Resolution: {resolution}
            </label>
            <input
              type="range"
              min={32}
              max={512}
              step={32}
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>32 (fast)</span>
              <span>512 (high quality)</span>
            </div>
          </div>
        )}

        <div className="bg-muted p-4 rounded-md">
          <h3 className="text-sm font-medium mb-1">Current SDF Tree</h3>
          <p className="text-xs text-muted-foreground font-mono">
            {tree.type}
            {tree.params && ` — ${JSON.stringify(tree.params)}`}
          </p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? 'Exporting...' : `Export as ${selectedFormat.toUpperCase()}`}
        </button>

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>
        )}

        {downloadUrl && (
          <div className="bg-primary/10 text-primary text-sm p-3 rounded-md space-y-2">
            <p>Export complete!</p>
            <a
              href={downloadUrl}
              download
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90"
            >
              Download {selectedFormat.toUpperCase()}
            </a>
          </div>
        )}

        {shaderResult && (
          <div className="bg-primary/10 text-primary text-sm p-3 rounded-md space-y-2">
            <div className="flex items-center justify-between">
              <p>Shader generated!</p>
              <button
                onClick={handleDownloadShader}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90"
              >
                Download
              </button>
            </div>
            <pre className="text-xs font-mono bg-background/50 p-3 rounded-md overflow-auto max-h-64">
              {shaderResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
