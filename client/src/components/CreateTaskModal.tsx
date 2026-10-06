'use client';

import React, { useState, useEffect } from 'react';
import { ProjectMember, Task, TaskPriority } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { AiAssistModal } from './AiAssistModal';
import { X, Loader2, Plus, Sparkles, Trash2, CheckSquare } from 'lucide-react';

interface CreateTaskModalProps {
  projectId: number;
  members: ProjectMember[];
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (task: Task) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  projectId,
  members,
  isOpen,
  onClose,
  onTaskCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');

  // Subtasks created via AI or manually in create form
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  // AI Assist State
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiFetch<{ enabled: boolean }>('/ai/status')
        .then((res) => setIsAiEnabled(Boolean(res.enabled)))
        .catch(() => setIsAiEnabled(false));
    } else {
      setTitle('');
      setDescription('');
      setPriority('MEDIUM');
      setAssigneeId(null);
      setDueDate('');
      setPendingSubtasks([]);
      setNewSubtaskInput('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddPendingSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskInput.trim()) return;
    if (pendingSubtasks.length >= 15) {
      setError('Maximum 15 subtasks allowed.');
      return;
    }
    setPendingSubtasks((prev) => [...prev, newSubtaskInput.trim()]);
    setNewSubtaskInput('');
  };

  const handleRemovePendingSubtask = (idx: number) => {
    setPendingSubtasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const newTask = await apiFetch<Task>(`/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          priority,
          assignee_id: assigneeId,
          due_date: dueDate ? dueDate : null,
          subtasks: pendingSubtasks,
        }),
      });
      onTaskCreated(newTask);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiApply = (
    data: { description: string; subtasks: string[]; priority?: TaskPriority },
    modeOption?: 'replace' | 'append'
  ) => {
    if (data.description) {
      if (modeOption === 'append' && description.trim()) {
        setDescription((prev) => `${prev}\n\n${data.description}`);
      } else {
        setDescription(data.description);
      }
    }

    if (data.priority) {
      setPriority(data.priority);
    }

    if (data.subtasks && data.subtasks.length > 0) {
      setPendingSubtasks((prev) => [...prev, ...data.subtasks].slice(0, 15));
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-text/20 backdrop-blur-xs">
        <div className="bg-surface w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-app-border shadow-soft-lg relative animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-app-text font-heading">Add New Task</h2>
            </div>
            <button
              onClick={onClose}
              className="text-app-text-muted hover:text-app-text p-1.5 rounded-lg hover:bg-surface-soft transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error && (
              <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form id="create-task-form" onSubmit={handleSubmit} className="space-y-4">
              {/* Title Field with AI Assist Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-app-text">
                    Task Title <span className="text-[#B4413C]">*</span>
                  </label>

                  {isAiEnabled && (
                    <button
                      type="button"
                      disabled={title.trim().length < 3}
                      onClick={() => setIsAiModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-primary-soft text-primary hover:bg-primary-soft/80 transition-colors disabled:opacity-40"
                      title={title.trim().length < 3 ? 'Type at least 3 characters to enable AI Assist' : 'Draft task description & subtasks with AI'}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Assist</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-app-text mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Task details, requirements, or notes..."
                  className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Priority, Assignee & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">Assignee</label>
                  <select
                    value={assigneeId === null ? '' : assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent truncate"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              {/* Checklist / Subtasks Preview */}
              <div className="space-y-2 pt-2 border-t border-app-border">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                  <label className="text-xs font-bold text-app-text">Checklist Items ({pendingSubtasks.length})</label>
                </div>

                {pendingSubtasks.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {pendingSubtasks.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-surface-soft/60 rounded-lg text-xs">
                        <span className="truncate text-app-text font-medium flex-1">{st}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingSubtask(idx)}
                          className="text-app-text-muted hover:text-[#B4413C] p-0.5 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Subtask In Create Modal */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newSubtaskInput}
                    onChange={(e) => setNewSubtaskInput(e.target.value)}
                    placeholder="Add checklist item..."
                    maxLength={200}
                    className="flex-1 px-3 py-1.5 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={handleAddPendingSubtask}
                    disabled={!newSubtaskInput.trim()}
                    className="p-1.5 bg-surface border border-app-border hover:border-primary text-app-text rounded-lg text-xs disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-app-border bg-surface-soft/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-app-text-muted hover:text-app-text hover:bg-surface-soft rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-task-form"
              disabled={submitting || !title.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Task</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Assist Modal */}
      <AiAssistModal
        projectId={projectId}
        title={title}
        existingDescription={description}
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApply={handleAiApply}
      />
    </>
  );
};
