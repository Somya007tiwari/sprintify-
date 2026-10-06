'use client';

import React from 'react';
import Link from 'next/link';
import { Meeting, RsvpStatus } from '@/lib/types';
import { Avatar } from './Avatar';
import { useAuth } from '@/lib/auth-context';
import { Calendar, Clock, Video, Check, X, Play, Trash2, Edit2, AlertCircle } from 'lucide-react';

interface MeetingCardProps {
  meeting: Meeting;
  onRsvp: (meetingId: number, rsvp: RsvpStatus) => void;
  onStartMeeting?: (meetingId: number) => void;
  onDeleteMeeting?: (meetingId: number) => void;
  onEditMeeting?: (meeting: Meeting) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  onRsvp,
  onStartMeeting,
  onDeleteMeeting,
  onEditMeeting,
}) => {
  const { user } = useAuth();
  const isCreator = user && meeting.created_by === user.id;

  // Format date in user's local timezone
  const scheduledDate = new Date(meeting.scheduled_at);
  const formattedDate = scheduledDate.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = scheduledDate.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate countdown text if scheduled in the future
  const now = new Date();
  const diffMs = scheduledDate.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);

  let countdownText: string | null = null;
  if (meeting.status === 'SCHEDULED') {
    if (diffMins > 0) {
      if (diffHours > 24) {
        const days = Math.floor(diffHours / 24);
        countdownText = `Starts in ${days}d ${diffHours % 24}h`;
      } else if (diffHours > 0) {
        countdownText = `Starts in ${diffHours}h ${diffMins % 60}m`;
      } else {
        countdownText = `Starts in ${diffMins}m`;
      }
    } else if (diffMins >= -30) {
      countdownText = 'Starting now';
    }
  }

  // Join button enabled check (LIVE or within 10 minutes of start)
  const canJoin = meeting.status === 'LIVE' || (meeting.status === 'SCHEDULED' && diffMins <= 10);

  // Current user's RSVP status
  const currentParticipant = meeting.participants?.find((p) => p.id === user?.id);
  const currentRsvp = currentParticipant?.rsvp || 'PENDING';

  return (
    <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft hover:shadow-soft-lg transition-all space-y-4">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Badge */}
            {meeting.status === 'LIVE' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E3F4E8] text-[#2E7D4F]">
                <span className="w-2 h-2 rounded-full bg-[#5DB67A] animate-ping" />
                <span>LIVE NOW</span>
              </span>
            ) : meeting.status === 'SCHEDULED' ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E8F1F8] text-[#7FB2D9]">
                SCHEDULED
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-soft text-app-text-muted">
                ENDED
              </span>
            )}

            {countdownText && (
              <span className="text-[11px] font-semibold text-primary bg-primary-soft/60 px-2 py-0.5 rounded-md">
                {countdownText}
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-app-text font-heading line-clamp-1 pt-1">
            {meeting.title}
          </h3>
        </div>

        {/* Creator actions */}
        {isCreator && (
          <div className="flex items-center gap-1">
            {onEditMeeting && meeting.status !== 'ENDED' && (
              <button
                onClick={() => onEditMeeting(meeting)}
                className="p-1.5 text-app-text-muted hover:text-primary rounded-lg hover:bg-surface-soft transition-colors"
                title="Edit meeting"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {onDeleteMeeting && (
              <button
                onClick={() => onDeleteMeeting(meeting.id)}
                className="p-1.5 text-app-text-muted hover:text-feedback-error rounded-lg hover:bg-[#FBDAD8]/40 transition-colors"
                title="Delete meeting"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {meeting.description && (
        <p className="text-xs text-app-text-muted line-clamp-2 leading-relaxed">
          {meeting.description}
        </p>
      )}

      {/* Date, Time & Duration */}
      <div className="flex items-center gap-4 text-xs font-medium text-app-text-muted flex-wrap">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>{formattedDate} at {formattedTime}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>{meeting.duration_minutes} mins</span>
        </div>
      </div>

      {/* Participant Avatars with RSVP Ring */}
      <div className="pt-2 border-t border-app-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-app-text-muted">Participants:</span>
          <div className="flex items-center -space-x-1.5">
            {meeting.participants?.map((p) => {
              const ringColor =
                p.rsvp === 'ACCEPTED'
                  ? 'ring-2 ring-[#5DB67A]'
                  : p.rsvp === 'DECLINED'
                  ? 'ring-2 ring-app-text-muted/40 opacity-50'
                  : 'ring-2 ring-[#F2B84B]';
              return (
                <div key={p.id} className="relative" title={`${p.name} (${p.rsvp})`}>
                  <Avatar name={p.name} size="xs" className={`${ringColor} ring-offset-1`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* RSVP Quick Actions */}
        {meeting.status === 'SCHEDULED' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRsvp(meeting.id, 'ACCEPTED')}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                currentRsvp === 'ACCEPTED'
                  ? 'bg-[#E3F4E8] text-[#2E7D4F] border-[#5DB67A]'
                  : 'bg-surface-soft border-app-border text-app-text-muted hover:text-app-text'
              }`}
              title="Accept RSVP"
            >
              <Check className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Accept</span>
            </button>
            <button
              onClick={() => onRsvp(meeting.id, 'DECLINED')}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-colors ${
                currentRsvp === 'DECLINED'
                  ? 'bg-[#FBDAD8] text-[#B4413C] border-[#B4413C]/40'
                  : 'bg-surface-soft border-app-border text-app-text-muted hover:text-app-text'
              }`}
              title="Decline RSVP"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Decline</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons: Join or Start */}
      <div className="pt-2 flex items-center justify-end gap-3">
        {isCreator && meeting.status === 'SCHEDULED' && onStartMeeting && (
          <button
            onClick={() => onStartMeeting(meeting.id)}
            className="px-3.5 py-1.5 bg-surface-soft hover:bg-primary-soft border border-app-border text-primary font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Start Meeting</span>
          </button>
        )}

        {meeting.status !== 'ENDED' && (
          <Link
            href={`/projects/${meeting.project_id}/meetings/${meeting.id}`}
            className={`px-4 py-2 font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-1.5 ${
              canJoin
                ? 'bg-primary hover:bg-primary-hover text-white'
                : 'bg-surface-soft text-app-text-muted border border-app-border cursor-not-allowed pointer-events-none'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>{meeting.status === 'LIVE' ? 'Join Live Room' : canJoin ? 'Enter Room' : 'Join Room'}</span>
          </Link>
        )}
      </div>
    </div>
  );
};
