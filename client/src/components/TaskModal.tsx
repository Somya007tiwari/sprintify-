'use client';

import React, { useState, useEffect } from 'react';
import { Task, ProjectMember, ActivityLog, TaskPriority } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { PriorityBadge } from './PriorityBadge';
import { ActivityList } from './ActivityList';
import { CommentsTab } from './CommentsTab';
import { FilesTab } from './FilesTab';
import { SubtasksList } from './SubtasksList';
import { AiAssistModal } from './AiAssistModal';
import {
  X,
  Trash2,
  Save,
  Loader2,
  History,
  AlertCircle,
  FileText,
  MessageSquare,
  Paperclip,
  Sparkles,
} from 'lucide-react';

interface TaskModalProps {
  task: Task | null;
  members: ProjectMember[];
  currentUserRole?: string;
  initialTab?: 'details' | 'comments' | 'files' | 'activity';
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted: (taskId: number) => void;
  typingUser?: string | null;
  onTyping?: () => void;
  realtimeRefreshKey?: number;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  task,
  members,
  currentUserRole,
  initialTab = 'details',
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  typingUser,
  onTyping,
  realtimeRefreshKey = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'files' | 'activity'>('details');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState<string>('');

  const [commentCount, setCommentCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'GENERATE' | 'SUBTASKS_ONLY'>('GENERATE');
  const [subtasksRefreshKey, setSubtasksRefreshKey] = useState(0);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority);
      setAssigneeId(task.assignee_id);
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '');
      setCommentCount(task.comment_count || 0);
      setAttachmentCount(task.attachment_count || 0);
      setActiveTab(initialTab);
      setError(null);
      fetchActivities(task.id);
    }
  }, [task, initialTab]);

  useEffect(() => {
    if (isOpen) {
      apiFetch<{ enabled: boolean }>('/ai/status')
        .then((res) => setIsAiEnabled(Boolean(res.enabled)))
        .catch(() => setIsAiEnabled(false));
    }
  }, [isOpen]);

  const handleSubtaskCountsChange = (total: number, done: number) => {
    if (task) {
      onTaskUpdated({
        ...task,
        subtask_total: total,
        subtask_done: done,
      });
    }
  };

  const handleAiApplyInEdit = async (
    data: { description: string; subtasks: string[]; priority?: TaskPriority },
    modeOption?: 'replace' | 'append'
  ) => {
    if (data.description && aiMode !== 'SUBTASKS_ONLY') {
      if (modeOption === 'append' && description.trim()) {
        setDescription((prev) => `${prev}\n\n${data.description}`);
      } else {
        setDescription(data.description);
      }
    }

    if (data.priority) {
      setPriority(data.priority);
    }

    if (data.subtasks && data.subtasks.length > 0 && task) {
      try {
        await apiFetch(`/tasks/${task.id}/subtasks/bulk`, {
          method: 'POST',
          body: JSON.stringify({ titles: data.subtasks }),
        });
        setSubtasksRefreshKey((prev) => prev + 1);
      } catch (err: any) {
        console.error('Failed to add AI generated subtasks:', err);
      }
    }
  };

  const fetchActivities = async (taskId: number) => {
    setLoadingActivities(true);
    try {
      const logs = await apiFetch<ActivityLog[]>(`/tasks/${taskId}/activity`);
      setActivities(logs);
    } catch (err) {
      console.error('Failed to load activity log:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  if (!isOpen || !task) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await apiFetch<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          description,
          priority,
          assignee_id: assigneeId,
          due_date: dueDate ? dueDate : null,
        }),
      });
      onTaskUpdated({
        ...updated,
        comment_count: commentCount,
        attachment_count: attachmentCount,
      });
      fetchActivities(task.id);
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setDeleting(true);
    setError(null);

    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: 'DELETE',
      });
      onTaskDeleted(task.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete task');
      setDeleting(false);
    }
  };

  const handleCommentCountDelta = (delta: number) => {
    const newCount = Math.max(0, commentCount + delta);
    setCommentCount(newCount);
    onTaskUpdated({
      ...task,
      comment_count: newCount,
      attachment_count: attachmentCount,
    });
    fetchActivities(task.id);
  };

  const handleAttachmentCountDelta = (delta: number) => {
    const newCount = Math.max(0, attachmentCount + delta);
    setAttachmentCount(newCount);
    onTaskUpdated({
      ...task,
      comment_count: commentCount,
      attachment_count: newCount,
    });
    fetchActivities(task.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-app-text/20 backdrop-blur-xs">
      <div className="bg-surface w-full max-w-3xl rounded-xl border border-app-border shadow-soft-lg flex flex-col h-[90vh] max-h-[750px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-app-border bg-surface-soft/40">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-primary-soft text-primary">
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-xs font-semibold text-app-text-muted">Task #{task.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 text-app-text-muted hover:text-feedback-error hover:bg-[#FBDAD8]/40 rounded-lg transition-colors"
              title="Delete task"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-surface-soft rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-app-border bg-surface">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'details'
                ? 'bg-primary text-white shadow-xs'
                : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'comments'
                ? 'bg-primary text-white shadow-xs'
                : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comments</span>
            {commentCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'comments' ? 'bg-white/20 text-white' : 'bg-surface-soft text-app-text-muted'
                }`}
              >
                {commentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'files'
                ? 'bg-primary text-white shadow-xs'
                : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Files</span>
            {attachmentCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'files' ? 'bg-white/20 text-white' : 'bg-surface-soft text-app-text-muted'
                }`}
              >
                {attachmentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeTab === 'activity'
                ? 'bg-primary text-white shadow-xs'
                : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>
        </div>

        {/* Modal Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {activeTab === 'details' && (
            /* Details Tab: Form & Info */
            <form onSubmit={handleSave} className="space-y-5 max-w-2xl mx-auto">
              {error && (
                <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-3 rounded-lg text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-app-text">Task Title</label>
                  {isAiEnabled && (
                    <button
                      type="button"
                      disabled={title.trim().length < 3}
                      onClick={() => {
                        setAiMode('GENERATE');
                        setIsAiModalOpen(true);
                      }}
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
                  className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-app-text mb-1.5">Description</label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add task details, acceptance criteria, or background notes..."
                  className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none leading-relaxed"
                />
              </div>

              {/* Subtasks / Checklist Component */}
              <SubtasksList
                key={`${task.id}-${subtasksRefreshKey}`}
                taskId={task.id}
                projectId={task.project_id}
                onSubtaskCountsChange={handleSubtaskCountsChange}
                isAiEnabled={isAiEnabled}
                onGenerateAiSubtasksClick={() => {
                  setAiMode('SUBTASKS_ONLY');
                  setIsAiModalOpen(true);
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-app-text mb-1.5">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary truncate"
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
                    className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end border-t border-app-border">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'comments' && (
            /* Comments Tab */
            <CommentsTab
              key={`${task.id}-${realtimeRefreshKey}`}
              taskId={task.id}
              currentUserRole={currentUserRole}
              onCommentCountChange={handleCommentCountDelta}
              onTyping={onTyping}
              typingUser={typingUser}
            />
          )}

          {activeTab === 'files' && (
            /* Files Tab */
            <FilesTab
              key={`${task.id}-${realtimeRefreshKey}`}
              taskId={task.id}
              currentUserRole={currentUserRole}
              onAttachmentCountChange={handleAttachmentCountDelta}
            />
          )}

          {activeTab === 'activity' && (
            /* Activity Trail Tab */
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-app-border">
                <History className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-app-text">Full Activity Audit Trail</h4>
              </div>
              <ActivityList activities={activities} isLoading={loadingActivities} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
