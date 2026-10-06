'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { SearchResult, ProjectSearchResult, TaskSearchResult } from '@/lib/types';
import { HighlightText } from './HighlightText';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from './Avatar';
import {
  Search,
  X,
  LayoutGrid,
  PlusCircle,
  Bell,
  Folder,
  CheckCircle2,
  Clock,
  Circle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateProject?: () => void;
}

interface RecentProject {
  id: number;
  title: string;
}

export function addRecentProject(project: { id: number; title: string }) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('sprintify_recent_projects');
    let list: RecentProject[] = raw ? JSON.parse(raw) : [];
    list = list.filter((p) => p.id !== project.id);
    list.unshift(project);
    list = list.slice(0, 5);
    localStorage.setItem('sprintify_recent_projects', JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to update recent projects in localStorage:', e);
  }
}

export function getRecentProjects(): RecentProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('sprintify_recent_projects');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenCreateProject,
}) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult>({ projects: [], tasks: [] });
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent projects when opening
  useEffect(() => {
    if (isOpen) {
      setRecentProjects(getRecentProjects());
      setQuery('');
      setResults({ projects: [], tasks: [] });
      setError(null);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle debounced search API call
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults({ projects: [], tasks: [] });
      setLoading(false);
      setError(null);
      setActiveIndex(0);
      return;
    }

    setLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch<SearchResult>(`/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          signal: controller.signal,
        });
        setResults(res);
        setActiveIndex(0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Search failed');
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  // Flat list of selectable items for keyboard index navigation
  const flatItems: Array<
    | { type: 'quick'; id: string; action: () => void }
    | { type: 'recent'; project: RecentProject }
    | { type: 'project'; project: ProjectSearchResult }
    | { type: 'task'; task: TaskSearchResult }
  > = [];

  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    // Quick Actions
    flatItems.push({
      type: 'quick',
      id: 'dashboard',
      action: () => {
        onClose();
        router.push('/dashboard');
      },
    });
    flatItems.push({
      type: 'quick',
      id: 'create_project',
      action: () => {
        onClose();
        if (onOpenCreateProject) {
          onOpenCreateProject();
        } else {
          router.push('/dashboard?create=true');
        }
      },
    });

    // Recent Projects
    recentProjects.forEach((p) => {
      flatItems.push({ type: 'recent', project: p });
    });
  } else {
    results.projects.forEach((p) => {
      flatItems.push({ type: 'project', project: p });
    });
    results.tasks.forEach((t) => {
      flatItems.push({ type: 'task', task: t });
    });
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[activeIndex]) {
        selectItem(flatItems[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const selectItem = (item: typeof flatItems[0]) => {
    onClose();
    if (item.type === 'quick') {
      item.action();
    } else if (item.type === 'recent') {
      router.push(`/projects/${item.project.id}`);
    } else if (item.type === 'project') {
      addRecentProject({ id: item.project.id, title: item.project.title });
      router.push(`/projects/${item.project.id}`);
    } else if (item.type === 'task') {
      router.push(`/projects/${item.task.project_id}?task=${item.task.id}`);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'DONE':
        return <span className="w-2 h-2 rounded-full bg-[#5DB67A] shrink-0" />;
      case 'IN_PROGRESS':
        return <span className="w-2 h-2 rounded-full bg-[#F2B84B] shrink-0" />;
      default:
        return <span className="w-2 h-2 rounded-full bg-[#7FB2D9] shrink-0" />;
    }
  };

  let globalIdx = 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-app-text/30 backdrop-blur-xs animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-xl rounded-2xl border border-app-border shadow-soft-xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150 relative"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-app-border bg-surface-soft/40">
          <Search className="w-5 h-5 text-primary shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects, tasks, or actions..."
            className="flex-1 bg-transparent text-sm font-medium text-app-text placeholder:text-app-text-muted focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0 mr-2" />}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-app-text-muted hover:text-app-text rounded-md hover:bg-surface transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold text-app-text-muted bg-surface border border-app-border rounded-md shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 divide-y divide-app-border/40 text-xs">
          {error && (
            <div className="p-4 text-center text-feedback-error space-y-2">
              <p>{error}</p>
              <button
                onClick={() => setQuery(query)}
                className="px-3 py-1 bg-surface border border-app-border rounded-lg text-xs font-semibold text-app-text hover:bg-surface-soft"
              >
                Retry
              </button>
            </div>
          )}

          {!error && trimmedQuery.length < 2 && (
            <div className="space-y-3 p-2">
              {/* Quick Actions */}
              <div>
                <div className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider px-2 py-1">
                  Quick Actions
                </div>
                <div className="space-y-1">
                  {/* Dashboard */}
                  {(() => {
                    const idx = globalIdx++;
                    const isActive = activeIndex === idx;
                    return (
                      <div
                        data-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectItem(flatItems[idx])}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <LayoutGrid className="w-4 h-4 text-primary" />
                          <span>Go to Dashboard</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                    );
                  })()}

                  {/* Create Project */}
                  {(() => {
                    const idx = globalIdx++;
                    const isActive = activeIndex === idx;
                    return (
                      <div
                        data-index={idx}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => selectItem(flatItems[idx])}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <PlusCircle className="w-4 h-4 text-primary" />
                          <span>Create new project</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Recent Projects */}
              {recentProjects.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider px-2 py-1">
                    Recently Visited Projects
                  </div>
                  <div className="space-y-1">
                    {recentProjects.map((p) => {
                      const idx = globalIdx++;
                      const isActive = activeIndex === idx;
                      return (
                        <div
                          key={p.id}
                          data-index={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(flatItems[idx])}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                            isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Folder className="w-4 h-4 text-accent" />
                            <span>{p.title}</span>
                          </div>
                          <span className="text-[10px] text-app-text-muted">Project #{p.id}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!error && trimmedQuery.length >= 2 && !loading && flatItems.length === 0 && (
            <div className="p-8 text-center text-app-text-muted space-y-1">
              <Search className="w-6 h-6 mx-auto opacity-40 mb-2" />
              <p className="font-semibold text-app-text">No results for "{query}"</p>
              <p className="text-[11px]">Try searching for task titles or project names</p>
            </div>
          )}

          {!error && trimmedQuery.length >= 2 && flatItems.length > 0 && (
            <div className="space-y-3 p-2">
              {/* Projects Group */}
              {results.projects.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider px-2 py-1">
                    Projects ({results.projects.length})
                  </div>
                  <div className="space-y-1">
                    {results.projects.map((p) => {
                      const idx = globalIdx++;
                      const isActive = activeIndex === idx;
                      return (
                        <div
                          key={p.id}
                          data-index={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(flatItems[idx])}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Folder className="w-4 h-4 text-accent shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-bold truncate text-app-text">
                                <HighlightText text={p.title} highlight={query} />
                              </div>
                              {p.description_snippet && (
                                <p className="text-[11px] text-app-text-muted truncate mt-0.5">
                                  {p.description_snippet}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-surface border border-app-border text-[10px] font-bold text-app-text-muted shrink-0 ml-2">
                            {p.task_count} tasks
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks Group */}
              {results.tasks.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider px-2 py-1">
                    Tasks ({results.tasks.length})
                  </div>
                  <div className="space-y-1">
                    {results.tasks.map((t) => {
                      const idx = globalIdx++;
                      const isActive = activeIndex === idx;
                      return (
                        <div
                          key={t.id}
                          data-index={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => selectItem(flatItems[idx])}
                          className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isActive ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {getStatusDot(t.status)}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate text-app-text">
                                <HighlightText text={t.title} highlight={query} />
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-app-text-muted mt-0.5">
                                <span className="font-medium text-app-text-muted truncate">{t.project_title}</span>
                                <span>•</span>
                                <PriorityBadge priority={t.priority} size="sm" />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            {t.assignee ? (
                              <Avatar name={t.assignee.name} size="sm" />
                            ) : (
                              <span className="text-[10px] text-app-text-muted italic">Unassigned</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Key Hints */}
        <div className="px-4 py-2 border-t border-app-border bg-surface-soft/60 flex items-center justify-between text-[11px] text-app-text-muted">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-app-border rounded text-[10px] font-bold">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-surface border border-app-border rounded text-[10px] font-bold">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-surface border border-app-border rounded text-[10px] font-bold">↵</kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface border border-app-border rounded text-[10px] font-bold">esc</kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </div>
  );
};
