'use client';

import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { Task, TaskStatus } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { apiFetch } from '@/lib/api';
import { AlertCircle } from 'lucide-react';

import { Search } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  allTasks?: Task[];
  isFiltered?: boolean;
  searchQuery?: string;
  onClearFilters?: () => void;
  onTasksChange: (newTasks: Task[]) => void;
  onTaskClick: (task: Task) => void;
  onOpenComments?: (task: Task) => void;
  onOpenFiles?: (task: Task) => void;
  onAddTaskClick: () => void;
  highlightedTaskId?: number | null;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'TODO', title: 'To Do' },
  { id: 'IN_PROGRESS', title: 'In Progress' },
  { id: 'DONE', title: 'Done' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  allTasks,
  isFiltered = false,
  searchQuery = '',
  onClearFilters,
  onTasksChange,
  onTaskClick,
  onOpenComments,
  onOpenFiles,
  onAddTaskClick,
  highlightedTaskId,
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const getColumnTasks = (status: TaskStatus) => {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  };

  const getColumnTotalCount = (status: TaskStatus) => {
    const source = allTasks || tasks;
    return source.filter((t) => t.status === status).length;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (isFiltered) return; // Prevent drag if filtered
    const { active } = event;
    const taskData = active.data.current?.task as Task;
    if (taskData) {
      setActiveTask(taskData);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (isFiltered) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();

    if (activeId === overId) return;

    const activeTaskData = active.data.current?.task as Task;
    if (!activeTaskData) return;

    // Determine target column and position
    let targetStatus: TaskStatus | null = null;
    if (['TODO', 'IN_PROGRESS', 'DONE'].includes(overId)) {
      targetStatus = overId as TaskStatus;
    } else if (over.data.current?.type === 'Task') {
      targetStatus = (over.data.current.task as Task).status;
    }

    if (!targetStatus || activeTaskData.status === targetStatus) return;

    // Temporarily update status in local state for smooth visual transition
    setTasksState((prevTasks) => {
      return prevTasks.map((t) => {
        if (t.id === activeTaskData.id) {
          return { ...t, status: targetStatus! };
        }
        return t;
      });
    });
  };

  const setTasksState = (updater: Task[] | ((prev: Task[]) => Task[])) => {
    const newTasks = typeof updater === 'function' ? updater(tasks) : updater;
    onTasksChange(newTasks);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isFiltered) {
      setActiveTask(null);
      return;
    }

    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeIdStr = active.id.toString().replace('task-', '');
    const activeTaskId = parseInt(activeIdStr, 10);
    const sourceList = allTasks || tasks;
    const draggedTask = sourceList.find((t) => t.id === activeTaskId);

    if (!draggedTask) return;

    let targetStatus: TaskStatus = draggedTask.status;
    const overIdStr = over.id.toString();

    if (['TODO', 'IN_PROGRESS', 'DONE'].includes(overIdStr)) {
      targetStatus = overIdStr as TaskStatus;
    } else if (over.data.current?.type === 'Task') {
      targetStatus = (over.data.current.task as Task).status;
    }

    const colTasks = sourceList
      .filter((t) => t.status === targetStatus && t.id !== activeTaskId)
      .sort((a, b) => a.position - b.position);

    let newPosition = colTasks.length; // default to end

    if (over.data.current?.type === 'Task') {
      const overTaskId = parseInt(overIdStr.replace('task-', ''), 10);
      const overIndex = colTasks.findIndex((t) => t.id === overTaskId);
      if (overIndex !== -1) {
        newPosition = overIndex;
      }
    }

    // Save previous state for rollback
    const previousTasksState = [...sourceList];

    // Optimistic local state update
    const updatedTasks = sourceList.map((t) => {
      if (t.id === activeTaskId) {
        return { ...t, status: targetStatus, position: newPosition };
      }
      return t;
    });

    // Re-index position contiguously per column
    const finalOptimisticTasks = ['TODO', 'IN_PROGRESS', 'DONE'].flatMap((st) => {
      const colItems = updatedTasks
        .filter((t) => t.status === st)
        .sort((a, b) => (a.id === activeTaskId ? newPosition - 0.5 : a.position));
      return colItems.map((item, idx) => ({ ...item, position: idx }));
    });

    onTasksChange(finalOptimisticTasks);

    // Call backend API
    try {
      const persistedTask = await apiFetch<Task>(`/tasks/${activeTaskId}/move`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: targetStatus,
          position: newPosition,
        }),
      });

      // Update with exact server returned task preserving counts
      onTasksChange(
        finalOptimisticTasks.map((t) => (t.id === activeTaskId ? { ...t, ...persistedTask } : t))
      );
    } catch (err: any) {
      // Rollback on failure
      console.error('Failed to persist drag position:', err);
      onTasksChange(previousTasksState);
      setToastError(err.message || 'Failed to save task move. Reverting changes.');
      setTimeout(() => setToastError(null), 4000);
    }
  };

  const totalAllTasks = allTasks ? allTasks.length : tasks.length;
  const isEntireBoardEmptyFiltered = isFiltered && totalAllTasks > 0 && tasks.length === 0;

  return (
    <div className="relative">
      {/* Toast Notification Error */}
      {toastError && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#FBDAD8] border border-[#B4413C]/40 text-[#B4413C] px-4 py-3 rounded-xl shadow-soft-lg text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-bottom-5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastError}</span>
        </div>
      )}

      {/* Empty Board State when Filtered */}
      {isEntireBoardEmptyFiltered ? (
        <div className="bg-surface rounded-2xl border border-app-border p-12 text-center max-w-md mx-auto my-6 space-y-3 shadow-soft">
          <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto">
            <Search className="w-6 h-6 opacity-80" />
          </div>
          <h3 className="text-base font-bold text-app-text font-heading">No matching tasks found</h3>
          <p className="text-xs text-app-text-muted leading-relaxed">
            No tasks match your active filter settings. Try adjusting your search query or clear all filters.
          </p>
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="px-4 py-2 bg-primary text-white font-semibold text-xs rounded-xl shadow-xs hover:bg-primary-hover transition-colors inline-block mt-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={isFiltered ? [] : sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col md:flex-row gap-6 items-start overflow-x-auto pb-6">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                status={col.id}
                title={col.title}
                tasks={getColumnTasks(col.id)}
                totalCount={getColumnTotalCount(col.id)}
                isFiltered={isFiltered}
                searchQuery={searchQuery}
                onClearFilters={onClearFilters}
                onTaskClick={onTaskClick}
                onOpenComments={onOpenComments}
                onOpenFiles={onOpenFiles}
                onAddTaskClick={col.id === 'TODO' ? onAddTaskClick : undefined}
                highlightedTaskId={highlightedTaskId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
};
