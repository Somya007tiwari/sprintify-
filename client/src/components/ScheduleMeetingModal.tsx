'use client';

import React, { useState } from 'react';
import { ProjectMember, Meeting } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { X, Calendar, Clock, Users, Loader2, Video } from 'lucide-react';

interface ScheduleMeetingModalProps {
  projectId: number;
  members: ProjectMember[];
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated: (meeting: Meeting) => void;
}

export const ScheduleMeetingModal: React.FC<ScheduleMeetingModalProps> = ({
  projectId,
  members,
  isOpen,
  onClose,
  onMeetingCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Default scheduled_at to tomorrow at 10:00 AM
  const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  defaultDate.setMinutes(0, 0, 0);
  const localIsoString = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const [scheduledAt, setScheduledAt] = useState(localIsoString);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(members.map((m) => m.id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        throw new Error('Please select a valid date and time.');
      }

      const newMeeting = await apiFetch<Meeting>(`/projects/${projectId}/meetings`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: durationMinutes,
          participant_ids: selectedUserIds,
        }),
      });

      onMeetingCreated(newMeeting);
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule meeting');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-text/20 backdrop-blur-xs">
      <div className="bg-surface w-full max-w-lg rounded-xl border border-app-border shadow-soft-lg p-6 space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <Video className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-app-text font-heading">Schedule Video Meeting</h2>
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
              Meeting Title <span className="text-[#B4413C]">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q4 Roadmap Alignment & Review"
              className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda or topics to discuss..."
              className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-app-text mb-1.5">
                Date & Time
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-app-text mb-1.5">
                Duration
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Invite Team Members
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-surface-soft/60 rounded-lg border border-app-border/60">
              {members.map((m) => {
                const isSelected = selectedUserIds.includes(m.id);
                return (
                  <label
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors ${
                      isSelected ? 'bg-surface font-semibold text-app-text border border-app-border/80' : 'text-app-text-muted hover:bg-surface/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleUser(m.id)}
                        className="rounded border-app-border text-primary focus:ring-primary"
                      />
                      <span>{m.name}</span>
                    </div>
                    <span className="text-[11px] text-app-text-muted">{m.email}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-app-border">
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
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Schedule Meeting</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
