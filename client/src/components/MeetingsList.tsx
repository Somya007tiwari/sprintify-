'use client';

import React, { useState, useEffect } from 'react';
import { Meeting, ProjectMember, RsvpStatus } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { MeetingCard } from './MeetingCard';
import { ScheduleMeetingModal } from './ScheduleMeetingModal';
import { Video, Plus, Loader2, CalendarX, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MeetingsListProps {
  projectId: number;
  members: ProjectMember[];
}

export const MeetingsList: React.FC<MeetingsListProps> = ({ projectId, members }) => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [startingInstant, setStartingInstant] = useState(false);
  const router = useRouter();

  const fetchMeetings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Meeting[]>(`/projects/${projectId}/meetings`);
      setMeetings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchMeetings();
    }
  }, [projectId]);

  const handleStartInstantMeeting = async () => {
    setStartingInstant(true);
    try {
      const instantMeeting = await apiFetch<Meeting>(`/projects/${projectId}/meetings/instant`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      router.push(`/projects/${projectId}/meetings/${instantMeeting.id}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start instant meeting');
      setStartingInstant(false);
    }
  };

  const handleMeetingCreated = (newMeeting: Meeting) => {
    setMeetings((prev) => [newMeeting, ...prev]);
  };

  const handleRsvp = async (meetingId: number, rsvp: RsvpStatus) => {
    try {
      const updated = await apiFetch<Meeting>(`/meetings/${meetingId}/rsvp`, {
        method: 'PATCH',
        body: JSON.stringify({ rsvp }),
      });
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updated : m)));
    } catch (err: any) {
      alert(err.message || 'Failed to update RSVP');
    }
  };

  const handleStartMeeting = async (meetingId: number) => {
    try {
      const updated = await apiFetch<Meeting>(`/meetings/${meetingId}/start`, {
        method: 'POST',
      });
      setMeetings((prev) => prev.map((m) => (m.id === meetingId ? updated : m)));
      router.push(`/projects/${projectId}/meetings/${meetingId}`);
    } catch (err: any) {
      alert(err.message || 'Failed to start meeting');
    }
  };

  const handleDeleteMeeting = async (meetingId: number) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await apiFetch(`/meetings/${meetingId}`, {
        method: 'DELETE',
      });
      setMeetings((prev) => prev.filter((m) => m.id !== meetingId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete meeting');
    }
  };

  const now = new Date();
  const upcomingMeetings = meetings.filter(
    (m) => m.status === 'LIVE' || m.status === 'SCHEDULED' || new Date(m.scheduled_at) >= new Date(now.getTime() - 30 * 60 * 1000)
  );
  const pastMeetings = meetings.filter(
    (m) => m.status === 'ENDED' || (m.status !== 'LIVE' && new Date(m.scheduled_at) < new Date(now.getTime() - 30 * 60 * 1000))
  );

  return (
    <div className="space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-app-border">
        <div>
          <h2 className="text-xl font-bold text-app-text font-heading">Project Video Meetings</h2>
          <p className="text-xs text-app-text-muted mt-0.5">
            Schedule upcoming syncs or jump into instant video rooms with Jitsi
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleStartInstantMeeting}
            disabled={startingInstant}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs disabled:opacity-70"
          >
            {startingInstant ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>Start Instant Meeting</span>
          </button>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-soft hover:bg-primary-soft border border-app-border text-app-text hover:text-primary font-semibold text-xs rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Meeting</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-app-text-muted space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading video meetings...</p>
        </div>
      ) : error ? (
        <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-4 rounded-xl text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchMeetings} className="underline font-semibold">Retry</button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Upcoming & Live Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-app-text uppercase tracking-wider text-app-text-muted font-heading">
                Upcoming & Live ({upcomingMeetings.length})
              </h3>
            </div>

            {upcomingMeetings.length === 0 ? (
              <div className="bg-surface rounded-xl border border-app-border p-8 text-center space-y-3 shadow-soft">
                <CalendarX className="w-10 h-10 text-app-text-muted/50 mx-auto" />
                <p className="text-xs font-semibold text-app-text">No upcoming meetings scheduled</p>
                <p className="text-xs text-app-text-muted max-w-sm mx-auto">
                  Click "Start Instant Meeting" or "Schedule Meeting" to collaborate with your team.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {upcomingMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    onRsvp={handleRsvp}
                    onStartMeeting={handleStartMeeting}
                    onDeleteMeeting={handleDeleteMeeting}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Past Meetings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-app-text uppercase tracking-wider text-app-text-muted font-heading">
                Past Meetings ({pastMeetings.length})
              </h3>
            </div>

            {pastMeetings.length === 0 ? (
              <div className="bg-surface-soft/40 rounded-xl border border-app-border/60 p-6 text-center text-xs text-app-text-muted">
                No past meeting history yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-90">
                {pastMeetings.map((m) => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    onRsvp={handleRsvp}
                    onDeleteMeeting={handleDeleteMeeting}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal */}
      <ScheduleMeetingModal
        projectId={projectId}
        members={members}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onMeetingCreated={handleMeetingCreated}
      />
    </div>
  );
};
