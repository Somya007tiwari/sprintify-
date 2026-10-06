'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/types';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from './Avatar';
import { HighlightText } from './HighlightText';
import { UserX, GripVertical, MessageSquare, Paperclip, CheckSquare, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  searchQuery?: string;
  onClick?: () => void;
  onOpenComments?: (task: Task) => void;
  onOpenFiles?: (task: Task) => void;
  isOverlay?: boolean;
  isHighlighted?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  searchQuery,
  onClick,
  onOpenComments,
  onOpenFiles,
  isOverlay = false,
  isHighlighted = false,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: 'Task',
      task,
    },
    disabled: isOverlay,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
  };

  const highlightClasses = isHighlighted
    ? 'ring-2 ring-primary ring-offset-1 ring-offset-app-bg bg-primary-soft/40 scale-[1.01]'
    : '';

  const cardClasses = isDragging
    ? 'opacity-30 border-primary border-dashed bg-primary-soft/30'
    : isOverlay
    ? 'rotate-2 shadow-soft-lg opacity-95 scale-[1.02] border-primary bg-surface cursor-grabbing'
    : `bg-surface border-app-border hover:border-primary/50 shadow-soft hover:shadow-soft-lg cursor-pointer transition-all duration-200 ${highlightClasses}`;

  const subtaskTotal = task.subtask_total || 0;
  const subtaskDone = task.subtask_done || 0;
  const allSubtasksDone = subtaskTotal > 0 && subtaskDone === subtaskTotal;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`rounded-xl border p-4 group select-none relative space-y-3 ${cardClasses}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-app-text line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          <HighlightText text={task.title} highlight={searchQuery} />
        </h3>
        
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="text-app-text-muted/40 group-hover:text-app-text-muted p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-surface-soft transition-colors shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-app-text-muted line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-app-border/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          <PriorityBadge priority={task.priority} size="sm" />

          {/* Due Date Badge */}
          {task.due_date && (
            (() => {
              const dateObj = new Date(task.due_date);
              const taskDateStr = dateObj.toISOString().split('T')[0];
              const todayStr = new Date().toISOString().split('T')[0];
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];
              const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj);

              if (task.status === 'DONE') {
                return (
                  <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-surface-soft text-app-text-muted" title={`Due: ${formattedDate}`}>
                    <Calendar className="w-3 h-3" />
                    <span>{formattedDate}</span>
                  </span>
                );
              }

              if (taskDateStr < todayStr) {
                return (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#FBDAD8]/70 text-feedback-error border border-[#FBDAD8]" title={`Overdue since ${formattedDate}`}>
                    <Calendar className="w-3 h-3" />
                    <span>Overdue</span>
                  </span>
                );
              }

              if (taskDateStr === todayStr) {
                return (
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-[#FDF3E3] text-[#A8680F] border border-[#FDF3E3]" title="Due today">
                    <Calendar className="w-3 h-3" />
                    <span>Today</span>
                  </span>
                );
              }

              if (taskDateStr === tomorrowStr) {
                return (
                  <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-surface-soft text-app-text-muted" title="Due tomorrow">
                    <Calendar className="w-3 h-3" />
                    <span>Tomorrow</span>
                  </span>
                );
              }

              return (
                <span className="flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md bg-surface-soft text-app-text-muted" title={`Due: ${formattedDate}`}>
                  <Calendar className="w-3 h-3" />
                  <span>{formattedDate}</span>
                </span>
              );
            })()
          )}

          {/* Subtask Progress Chip */}
          {subtaskTotal > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onClick) onClick();
              }}
              className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-colors ${
                allSubtasksDone
                  ? 'bg-col-done text-badge-low-text font-semibold'
                  : 'text-app-text-muted hover:text-primary hover:bg-surface-soft'
              }`}
              title={`Subtasks: ${subtaskDone}/${subtaskTotal} completed`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{subtaskDone}/{subtaskTotal}</span>
            </button>
          )}

          {/* Comment & Attachment Counts */}
          {(task.comment_count || 0) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenComments) onOpenComments(task);
                else if (onClick) onClick();
              }}
              className="flex items-center gap-1 text-app-text-muted hover:text-primary transition-colors p-0.5 rounded"
              title={`${task.comment_count} comments`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">{task.comment_count}</span>
            </button>
          )}

          {(task.attachment_count || 0) > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenFiles) onOpenFiles(task);
                else if (onClick) onClick();
              }}
              className="flex items-center gap-1 text-app-text-muted hover:text-primary transition-colors p-0.5 rounded"
              title={`${task.attachment_count} attachments`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">{task.attachment_count}</span>
            </button>
          )}
        </div>

        {/* Assignee Avatar */}
        {task.assignee ? (
          <Avatar name={task.assignee.name} size="sm" />
        ) : (
          <div
            title="Unassigned"
            className="w-7 h-7 rounded-full bg-surface-soft border border-app-border flex items-center justify-center text-app-text-muted shrink-0"
          >
            <UserX className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};
