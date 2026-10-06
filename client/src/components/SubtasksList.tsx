'use client';

import React, { useState, useEffect } from 'react';
import { Subtask } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { CheckSquare, Square, Trash2, Plus, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface SubtasksListProps {
  taskId: number;
  projectId?: number;
  onSubtaskCountsChange?: (total: number, done: number) => void;
  onGenerateAiSubtasksClick?: () => void;
  isAiEnabled?: boolean;
}

export const SubtasksList: React.FC<SubtasksListProps> = ({
  taskId,
  onSubtaskCountsChange,
  onGenerateAiSubtasksClick,
  isAiEnabled = false,
}) => {
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New subtask input state
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const fetchSubtasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Subtask[]>(`/tasks/${taskId}/subtasks`);
      setSubtasks(data);
      notifyCountChange(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchSubtasks();
    }
  }, [taskId]);

  const notifyCountChange = (list: Subtask[]) => {
    if (onSubtaskCountsChange) {
      const total = list.length;
      const done = list.filter((s) => s.done).length;
      onSubtaskCountsChange(total, done);
    }
  };

  const handleToggleDone = async (subtask: Subtask) => {
    const newDoneState = !subtask.done;
    // Optimistic local update
    const previous = [...subtasks];
    const updated = subtasks.map((s) => (s.id === subtask.id ? { ...s, done: newDoneState } : s));
    setSubtasks(updated);
    notifyCountChange(updated);

    try {
      await apiFetch<Subtask>(`/subtasks/${subtask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: newDoneState }),
      });
    } catch (err: any) {
      // Rollback
      setSubtasks(previous);
      notifyCountChange(previous);
      setError(err.message || 'Failed to update subtask');
    }
  };

  const handleAddSubtask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim()) return;

    const titleToAdd = newTitle.trim();
    setNewTitle('');
    setIsAdding(true);
    setError(null);

    try {
      const created = await apiFetch<Subtask>(`/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title: titleToAdd }),
      });
      const updated = [...subtasks, created];
      setSubtasks(updated);
      notifyCountChange(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to add subtask');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSaveInlineEdit = async (subtask: Subtask) => {
    if (!editingTitle.trim() || editingTitle.trim() === subtask.title) {
      setEditingId(null);
      return;
    }

    const updatedTitle = editingTitle.trim();
    setEditingId(null);

    const previous = [...subtasks];
    const updated = subtasks.map((s) => (s.id === subtask.id ? { ...s, title: updatedTitle } : s));
    setSubtasks(updated);

    try {
      await apiFetch<Subtask>(`/subtasks/${subtask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: updatedTitle }),
      });
    } catch (err: any) {
      setSubtasks(previous);
      setError(err.message || 'Failed to rename subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    const previous = [...subtasks];
    const updated = subtasks.filter((s) => s.id !== subtaskId);
    setSubtasks(updated);
    notifyCountChange(updated);

    try {
      await apiFetch(`/subtasks/${subtaskId}`, {
        method: 'DELETE',
      });
    } catch (err: any) {
      setSubtasks(previous);
      notifyCountChange(previous);
      setError(err.message || 'Failed to delete subtask');
    }
  };

  const totalCount = subtasks.length;
  const doneCount = subtasks.filter((s) => s.done).length;
  const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3 pt-4 border-t border-app-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-app-text font-heading">Checklist</h4>
          {totalCount > 0 && (
            <span className="text-[11px] font-semibold text-app-text-muted">
              {doneCount}/{totalCount} ({progressPercent}%)
            </span>
          )}
        </div>

        {isAiEnabled && onGenerateAiSubtasksClick && (
          <button
            type="button"
            onClick={onGenerateAiSubtasksClick}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover bg-primary-soft hover:bg-primary-soft/80 px-2.5 py-1 rounded-lg transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            <span>Generate subtasks with AI</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-2.5 rounded-lg text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-0.5 hover:bg-black/5 rounded">
            &times;
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {totalCount > 0 && (
        <div className="w-full h-1.5 bg-surface-soft rounded-full overflow-hidden border border-app-border/40">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Subtasks List */}
      {isLoading ? (
        <div className="py-4 flex items-center justify-center text-app-text-muted text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading checklist...</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {subtasks.map((subtask) => {
            const isEditing = editingId === subtask.id;

            return (
              <div
                key={subtask.id}
                className="group flex items-center justify-between gap-2.5 p-2 rounded-lg hover:bg-surface-soft transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleDone(subtask)}
                    className="text-app-text-muted hover:text-primary transition-colors shrink-0"
                  >
                    {subtask.done ? (
                      <CheckSquare className="w-4 h-4 text-[#2E7D4F]" />
                    ) : (
                      <Square className="w-4 h-4 text-app-text-muted/60" />
                    )}
                  </button>

                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleSaveInlineEdit(subtask)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveInlineEdit(subtask);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 px-2 py-1 bg-surface border border-primary rounded text-xs text-app-text focus:outline-none"
                    />
                  ) : (
                    <span
                      onDoubleClick={() => {
                        setEditingId(subtask.id);
                        setEditingTitle(subtask.title);
                      }}
                      title="Double click to edit"
                      className={`flex-1 truncate cursor-pointer select-none ${
                        subtask.done ? 'line-through text-app-text-muted/70' : 'text-app-text font-medium'
                      }`}
                    >
                      {subtask.title}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteSubtask(subtask.id)}
                  className="p-1 text-app-text-muted/40 opacity-0 group-hover:opacity-100 hover:text-[#B4413C] hover:bg-[#FBDAD8]/40 rounded transition-all shrink-0"
                  title="Delete subtask"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Subtask Input Form */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddSubtask();
            }
          }}
          placeholder="Add a subtask... (Enter to save)"
          maxLength={200}
          className="flex-1 px-3 py-1.5 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all"
        />
        <button
          type="button"
          onClick={() => handleAddSubtask()}
          disabled={isAdding || !newTitle.trim()}
          className="p-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 shrink-0"
          title="Add subtask"
        >
          {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
