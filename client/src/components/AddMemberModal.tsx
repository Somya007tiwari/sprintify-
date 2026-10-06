'use client';

import React, { useState } from 'react';
import { ProjectMember } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { X, UserPlus, Loader2, Check } from 'lucide-react';

interface AddMemberModalProps {
  projectId: number;
  isOpen: boolean;
  onClose: () => void;
  onMembersUpdated: (updatedMembers: ProjectMember[]) => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  projectId,
  isOpen,
  onClose,
  onMembersUpdated,
}) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch<{ members: ProjectMember[] }>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      onMembersUpdated(res.members);
      setSuccess(true);
      setEmail('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-app-text/20 backdrop-blur-xs">
      <div className="bg-surface w-full max-w-md rounded-xl border border-app-border shadow-soft-lg p-6 space-y-5 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-app-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-app-text">Add Team Member</h2>
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

        {success && (
          <div className="bg-[#D9F0DF] border border-[#2E7D4F]/30 text-[#2E7D4F] p-3 rounded-lg text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            <span>Member added successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-app-text mb-1.5">
              Member Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., sarah@example.com"
              className="w-full px-3.5 py-2.5 bg-surface-soft border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-app-text-muted mt-1.5">
              User must already have an account on Sprintify.
            </p>
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
              disabled={submitting || !email.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <span>Add Member</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
