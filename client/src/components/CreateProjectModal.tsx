'use client';

import React, { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Project } from '@/lib/types';
import { X, Loader2, FolderPlus } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const newProject = await apiFetch<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify({ title, description }),
      });
      onProjectCreated(newProject);
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-text/20 backdrop-blur-xs">
      <div className="bg-surface w-full max-w-lg rounded-xl border border-app-border shadow-soft-lg p-6 space-y-6 relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <FolderPlus className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-app-text">Create New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="text-app-text-muted hover:text-app-text p-1.5 rounded-lg hover:bg-surface-soft transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3 rounded-lg text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Project Title <span className="text-[#B4413C]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprintify Web App v1.0"
              className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of project scope, sprint goals, or objectives..."
              className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-app-text-muted hover:text-app-text hover:bg-surface-soft rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Project</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
