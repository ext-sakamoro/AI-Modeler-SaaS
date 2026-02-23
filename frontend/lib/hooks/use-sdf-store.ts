import { create } from 'zustand';
import type { SdfTree } from '@/lib/sdf/client';

interface SdfState {
  projectId: string | null;
  projectName: string;
  tree: SdfTree;
  selectedNodePath: string[];
  isCompiling: boolean;
  isGeneratingMesh: boolean;
  meshData: string | null;
  shaderSource: string | null;
  error: string | null;

  setProjectId: (id: string | null) => void;
  setProjectName: (name: string) => void;
  setTree: (tree: SdfTree) => void;
  setSelectedNodePath: (path: string[]) => void;
  setCompiling: (v: boolean) => void;
  setGeneratingMesh: (v: boolean) => void;
  setMeshData: (data: string | null) => void;
  setShaderSource: (source: string | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const defaultTree: SdfTree = {
  type: 'Sphere',
  params: { radius: 1.0 },
};

export const useSdfStore = create<SdfState>((set) => ({
  projectId: null,
  projectName: 'Untitled',
  tree: defaultTree,
  selectedNodePath: [],
  isCompiling: false,
  isGeneratingMesh: false,
  meshData: null,
  shaderSource: null,
  error: null,

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setTree: (tree) => set({ tree, error: null }),
  setSelectedNodePath: (path) => set({ selectedNodePath: path }),
  setCompiling: (v) => set({ isCompiling: v }),
  setGeneratingMesh: (v) => set({ isGeneratingMesh: v }),
  setMeshData: (data) => set({ meshData: data }),
  setShaderSource: (source) => set({ shaderSource: source }),
  setError: (error) => set({ error }),
  reset: () => set({
    projectId: null, projectName: 'Untitled', tree: defaultTree,
    selectedNodePath: [], isCompiling: false,
    isGeneratingMesh: false, meshData: null, shaderSource: null, error: null,
  }),
}));
