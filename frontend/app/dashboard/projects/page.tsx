'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Project {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setProjects(data || []);
    } catch {
      // Supabase not configured — show empty state
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    setCreating(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: 'Untitled Project',
          owner_id: user.id,
          sdf_tree: { type: 'Sphere', params: { radius: 1.0 } },
        })
        .select('id')
        .single();
      if (error) throw error;
      router.push(`/dashboard/editor?project=${data.id}`);
    } catch (err: unknown) {
      console.error('Failed to create project:', err);
      router.push('/dashboard/editor');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={handleCreateProject}
          disabled={creating}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'New Project'}
        </button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <p className="text-muted-foreground">No projects yet</p>
          <button
            onClick={handleCreateProject}
            disabled={creating}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/editor?project=${project.id}`}
              className="border border-border rounded-lg p-4 hover:border-primary transition-colors"
            >
              <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center text-muted-foreground text-sm">
                3D Preview
              </div>
              <h3 className="font-medium">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Updated {new Date(project.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
