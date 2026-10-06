'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { CreateProjectModal } from '@/components/CreateProjectModal';
import { apiFetch } from '@/lib/api';
import { Project } from '@/lib/types';
import { Plus, FolderKanban, Users, CheckSquare, ArrowRight, Loader2, Calendar } from 'lucide-react';

import { useSearchParams } from 'next/navigation';

function DashboardContent() {
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Project[]>('/projects');
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
  };

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-app-border">
          <div>
            <h1 className="text-2xl font-bold text-app-text tracking-tight">Your Projects</h1>
            <p className="text-xs text-app-text-muted mt-1">
              Select a project workspace to launch its Kanban board
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-app-text-muted space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">Loading project workspace...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-4 rounded-xl text-xs flex justify-between items-center">
            <span>{error}</span>
            <button onClick={fetchProjects} className="underline font-semibold">Retry</button>
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="bg-surface rounded-xl border border-app-border p-12 text-center max-w-md mx-auto space-y-4 shadow-soft">
            <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto">
              <FolderKanban className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-app-text">No projects yet</h3>
              <p className="text-xs text-app-text-muted">
                Create your first project to start organizing tasks with drag-and-drop Kanban columns.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          /* Project Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group bg-surface rounded-xl border border-app-border p-6 shadow-soft hover:shadow-soft-lg hover:border-primary/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-bold text-app-text group-hover:text-primary transition-colors line-clamp-1">
                      {project.title}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        project.role === 'OWNER'
                          ? 'bg-[#FFF1D6] text-[#A8680F]'
                          : 'bg-[#E8F1F8] text-[#7FB2D9]'
                      }`}
                    >
                      {project.role || 'MEMBER'}
                    </span>
                  </div>

                  <p className="text-xs text-app-text-muted line-clamp-2 min-h-[2.5rem]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-app-border flex items-center justify-between text-xs text-app-text-muted">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{project.member_count || 1}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{project.task_count || 0} tasks</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-primary group-hover:translate-x-1 transition-transform font-semibold">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-app-bg flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardContent />
    </React.Suspense>
  );
}
