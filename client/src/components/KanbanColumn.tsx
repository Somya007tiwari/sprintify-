'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { Plus } from 'lucide-react';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  totalCount?: number;
  isFiltered?: boolean;
  searchQuery?: string;
  onClearFilters?: () => void;
  onTaskClick: (task: Task) => void;
  onOpenComments?: (task: Task) => void;
  onOpenFiles?: (task: Task) => void;
  onAddTaskClick?: () => void;
  highlightedTaskId?: number | null;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  title,
  tasks,
  totalCount,
  isFiltered = false,
  searchQuery,
  onClearFilters,
  onTaskClick,
  onOpenComments,
  onOpenFiles,
  onAddTaskClick,
  highlightedTaskId,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
  });

  const config = {
    TODO: {
      bg: 'bg-[#E8F1F8]',
      dot: 'bg-[#7FB2D9]',
    },
    IN_PROGRESS: {
      bg: 'bg-[#FFF1D6]',
      dot: 'bg-[#F2B84B]',
    },
    DONE: {
      bg: 'bg-[#E3F4E8]',
      dot: 'bg-[#5DB67A]',
    },
  }[status];

  const itemIds = tasks.map((t) => `task-${t.id}`);
  const total = totalCount !== undefined ? totalCount : tasks.length;
  const countDisplay = isFiltered ? `${tasks.length} of ${total}` : `${total}`;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[280px] max-w-sm rounded-xl border p-4 transition-colors duration-200 ${
        isOver
          ? 'bg-primary-soft/60 border-primary border-dashed shadow-soft-lg'
          : 'bg-surface-soft/60 border-app-border'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-app-border/60">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${config.dot} shadow-xs`} />
          <h2 className="text-sm font-bold text-app-text font-heading">{title}</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} text-app-text`}>
            {countDisplay}
          </span>
        </div>

        {onAddTaskClick && (
          <button
            onClick={onAddTaskClick}
            className="p-1 text-app-text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors"
            title="Add Task"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Task List */}
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-3 min-h-[150px]">
          {tasks.length === 0 ? (
            isFiltered ? (
              <div className="p-4 rounded-lg border border-dashed border-app-border/80 flex flex-col items-center justify-center text-center text-xs text-app-text-muted bg-surface/40 select-none space-y-1 py-8">
                <span>No tasks match your filters</span>
                {onClearFilters && (
                  <button
                    onClick={onClearFilters}
                    className="text-primary font-bold hover:underline mt-1"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="h-28 rounded-lg border border-dashed border-app-border flex items-center justify-center text-xs text-app-text-muted/60 bg-surface/40 select-none">
                Drop tasks here
              </div>
            )
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                searchQuery={searchQuery}
                onClick={() => onTaskClick(task)}
                onOpenComments={onOpenComments}
                onOpenFiles={onOpenFiles}
                isHighlighted={highlightedTaskId === task.id}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add Task Button at bottom of column */}
      {status === 'TODO' && onAddTaskClick && (
        <button
          onClick={onAddTaskClick}
          className="mt-3 w-full py-2 px-3 border border-dashed border-app-border hover:border-primary text-app-text-muted hover:text-primary hover:bg-surface rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </button>
      )}
    </div>
  );
};
