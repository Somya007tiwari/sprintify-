'use client';

import React from 'react';
import { ActivityLog } from '@/lib/types';
import { Avatar } from './Avatar';
import { History, PlusCircle, ArrowRightLeft, Edit3, UserCheck, MessageSquare, Paperclip } from 'lucide-react';

interface ActivityListProps {
  activities: ActivityLog[];
  isLoading?: boolean;
}

export const ActivityList: React.FC<ActivityListProps> = ({ activities, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="text-center py-6 text-xs text-app-text-muted">
        Loading activity trail...
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-6 text-xs text-app-text-muted space-y-1">
        <History className="w-5 h-5 mx-auto text-app-text-muted/60" />
        <p>No activity recorded for this task yet.</p>
      </div>
    );
  }

  const formatTime = (dateStr: string) => {
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

  const getActionDetails = (act: ActivityLog) => {
    const userName = act.user_name || 'Someone';
    const statusFormat = (s: string | null) => (s ? s.replace('_', ' ') : '');

    switch (act.action) {
      case 'CREATED':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5 text-primary" />,
          text: `${userName} created this task`,
        };
      case 'MOVED':
        return {
          icon: <ArrowRightLeft className="w-3.5 h-3.5 text-[#F2B84B]" />,
          text: `${userName} moved this from ${statusFormat(act.from_status)} to ${statusFormat(act.to_status)}`,
        };
      case 'ASSIGNED':
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-primary" />,
          text: `${userName} updated assignee`,
        };
      case 'COMMENTED':
        return {
          icon: <MessageSquare className="w-3.5 h-3.5 text-primary" />,
          text: `${userName} commented: "${act.metadata?.comment_preview || ''}"`,
        };
      case 'ATTACHED':
        return {
          icon: <Paperclip className="w-3.5 h-3.5 text-primary" />,
          text: `${userName} attached ${act.metadata?.name || 'file'}`,
        };
      case 'UPDATED':
      default:
        return {
          icon: <Edit3 className="w-3.5 h-3.5 text-app-text-muted" />,
          text: `${userName} updated task details`,
        };
    }
  };

  return (
    <div className="space-y-3">
      {activities.map((act) => {
        const { icon, text } = getActionDetails(act);
        return (
          <div key={act.id} className="flex items-start gap-3 text-xs bg-surface-soft/60 p-2.5 rounded-lg border border-app-border/40">
            <Avatar name={act.user_name || 'User'} size="xs" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-app-text">
                {icon}
                <span className="truncate">{text}</span>
              </div>
              <p className="text-[10px] text-app-text-muted mt-0.5">
                {formatTime(act.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
