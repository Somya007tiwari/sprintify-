'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Comment, ProjectMember } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { Avatar } from './Avatar';
import { useAuth } from '@/lib/auth-context';
import { Send, Edit2, Trash2, Check, X, MessageSquare, Loader2, AlertCircle } from 'lucide-react';

interface CommentsTabProps {
  taskId: number;
  currentUserRole?: string;
  onCommentCountChange?: (delta: number) => void;
  onTyping?: () => void;
  typingUser?: string | null;
}

export const CommentsTab: React.FC<CommentsTabProps> = ({
  taskId,
  currentUserRole,
  onCommentCountChange,
  onTyping,
  typingUser,
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [newCommentBody, setNewCommentBody] = useState('');
  const [sending, setSending] = useState(false);

  // Editing state
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Comment[]>(`/tasks/${taskId}/comments`);
      setComments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchComments();
    }
  }, [taskId]);

  useEffect(() => {
    // Auto-scroll to bottom after loading comments or adding new comment
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCommentBody.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setError(null);

    // Optimistic comment object
    const tempId = Date.now();
    const optimisticComment: Comment = {
      id: tempId,
      task_id: taskId,
      user_id: user?.id || null,
      body: trimmed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      edited: false,
      author: {
        id: user?.id || 0,
        name: user?.name || 'You',
        email: user?.email || '',
      },
    };

    setComments((prev) => [...prev, optimisticComment]);
    setNewCommentBody('');

    try {
      const created = await apiFetch<Comment>(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: trimmed }),
      });

      // Replace temp optimistic comment with server response
      setComments((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      if (onCommentCountChange) onCommentCountChange(1);
    } catch (err: any) {
      // Rollback optimistic comment
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setError(err.message || 'Failed to post comment');
      setNewCommentBody(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendComment();
    }
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditBody(comment.body);
  };

  const handleSaveEdit = async (commentId: number) => {
    const trimmed = editBody.trim();
    if (!trimmed) return;

    setSavingEdit(true);
    try {
      const updated = await apiFetch<Comment>(`/comments/${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body: trimmed }),
      });

      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setEditingCommentId(null);
    } catch (err: any) {
      alert(err.message || 'Failed to edit comment');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await apiFetch(`/comments/${commentId}`, {
        method: 'DELETE',
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (onCommentCountChange) onCommentCountChange(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatFullDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[380px]">
      {error && (
        <div className="mb-3 bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-2.5 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Chat Comments Thread (Oldest at top, scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-app-text-muted space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-xs font-semibold">Loading comments...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-app-text-muted space-y-2 text-center">
            <MessageSquare className="w-8 h-8 text-app-text-muted/40" />
            <p className="text-xs font-semibold text-app-text">No comments yet</p>
            <p className="text-xs">Start the discussion below.</p>
          </div>
        ) : (
          comments.map((c) => {
            const isAuthor = user && c.user_id === user.id;
            const isOwner = currentUserRole === 'OWNER';
            const canDelete = isAuthor || isOwner;
            const isEditing = editingCommentId === c.id;

            return (
              <div
                key={c.id}
                className="flex items-start gap-3 bg-surface-soft/60 p-3.5 rounded-xl border border-app-border/50 text-xs group"
              >
                <Avatar name={c.author.name} size="sm" />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-app-text">{c.author.name}</span>
                      <span
                        className="text-[10px] text-app-text-muted cursor-help"
                        title={formatFullDate(c.created_at)}
                      >
                        {formatRelativeTime(c.created_at)}
                      </span>
                      {c.edited && (
                        <span className="text-[10px] text-app-text-muted italic">
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {isAuthor && !isEditing && (
                        <button
                          onClick={() => handleStartEdit(c)}
                          className="p-1 text-app-text-muted hover:text-primary rounded transition-colors"
                          title="Edit comment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && !isEditing && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="p-1 text-app-text-muted hover:text-feedback-error rounded transition-colors"
                          title="Delete comment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        rows={2}
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="w-full p-2 bg-surface border border-app-border rounded-lg text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingCommentId(null)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-app-text-muted hover:bg-surface rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(c.id)}
                          disabled={savingEdit || !editBody.trim()}
                          className="px-2.5 py-1 bg-primary text-white font-semibold text-[11px] rounded flex items-center gap-1"
                        >
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-app-text whitespace-pre-wrap leading-relaxed break-words">
                      {c.body}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUser && (
        <div className="py-1 px-2 text-[11px] font-semibold text-primary italic flex items-center gap-1.5 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          <span>{typingUser} is typing...</span>
        </div>
      )}

      {/* Fixed Composer at bottom */}
      <form onSubmit={handleSendComment} className="pt-2 border-t border-app-border space-y-2 mt-auto">
        <div className="relative">
          <textarea
            rows={3}
            value={newCommentBody}
            onChange={(e) => {
              setNewCommentBody(e.target.value);
              if (onTyping) onTyping();
            }}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder="Write a comment... (Enter to send, Shift+Enter for new line)"
            className="w-full p-3 bg-surface-soft border border-app-border rounded-xl text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none pr-12"
          />
          <button
            type="submit"
            disabled={sending || !newCommentBody.trim()}
            className="absolute right-2.5 bottom-3.5 p-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            title="Send comment"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-app-text-muted px-1">
          <span>Press Enter to send</span>
          <span className={newCommentBody.length >= 1900 ? 'text-[#B4413C] font-semibold' : ''}>
            {newCommentBody.length} / 2000
          </span>
        </div>
      </form>
    </div>
  );
};
