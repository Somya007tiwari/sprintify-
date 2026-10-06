'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { KanbanBoard } from '@/components/KanbanBoard';
import { MeetingsList } from '@/components/MeetingsList';
import { AnalyticsTab } from '@/components/AnalyticsTab';
import { TaskModal } from '@/components/TaskModal';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { AddMemberModal } from '@/components/AddMemberModal';
import { RealtimeToast, ToastMessage } from '@/components/RealtimeToast';
import { Avatar } from '@/components/Avatar';
import { BoardFilterToolbar, BoardFilterToolbarRef } from '@/components/BoardFilterToolbar';
import { apiFetch } from '@/lib/api';
import { Project, Task, ProjectMember, Meeting, OnlineUser, BoardFilterState } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useProjectRealtime } from '@/lib/useProjectRealtime';
import { Plus, UserPlus, ArrowLeft, Loader2, LayoutGrid, Video, BarChart2 } from 'lucide-react';
import Link from 'next/link';

function ProjectDetailsContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = `/projects/${projectId}`;

  const tabParam = searchParams.get('tab');
  const activeTab: 'board' | 'meetings' | 'analytics' =
    tabParam === 'meetings' ? 'meetings' : tabParam === 'analytics' ? 'analytics' : 'board';

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Board Filter State
  const [boardFilters, setBoardFilters] = useState<BoardFilterState>({
    searchQuery: '',
    priorities: [],
    assignees: [],
    due: 'all',
    myTasksOnly: false,
  });
  const toolbarRef = useRef<BoardFilterToolbarRef>(null);

  // Realtime state
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState<number | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [modalRefreshKey, setModalRefreshKey] = useState<number>(0);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState<number>(0);
  const lastToastTimeRef = useRef<number>(0);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyticsDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAnalyticsRefetch = () => {
    if (activeTab === 'analytics') {
      if (analyticsDebounceTimerRef.current) clearTimeout(analyticsDebounceTimerRef.current);
      analyticsDebounceTimerRef.current = setTimeout(() => {
        setAnalyticsRefreshKey((prev) => prev + 1);
      }, 1500);
    }
  };

  // Modals state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskModalInitialTab, setTaskModalInitialTab] = useState<'details' | 'comments' | 'files' | 'activity'>('details');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);

  // Deep Link ?task=<taskId> Handler
  useEffect(() => {
    const taskParam = searchParams.get('task');
    if (taskParam && tasks.length > 0) {
      const targetTaskId = parseInt(taskParam, 10);
      if (!isNaN(targetTaskId)) {
        const target = tasks.find((t) => t.id === targetTaskId);
        if (target && (!selectedTask || selectedTask.id !== targetTaskId)) {
          setSelectedTask(target);
          setTaskModalInitialTab('details');
          setIsTaskModalOpen(true);
        }
      }
    }
  }, [searchParams, tasks]);

  // Board Keyboard Shortcuts ('/' to focus search, 'Escape' to clear)
  useEffect(() => {
    if (activeTab !== 'board') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        toolbarRef.current?.focusSearch();
      } else if (e.key === 'Escape') {
        toolbarRef.current?.clearSearch();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeTab]);

  const addToast = (message: string) => {
    const now = Date.now();
    if (now - lastToastTimeRef.current < 1000) return;
    lastToastTimeRef.current = now;

    const id = `toast-${now}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchProjectData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projData, taskData, meetingsData] = await Promise.all([
        apiFetch<Project>(`/projects/${projectId}`),
        apiFetch<Task[]>(`/projects/${projectId}/tasks`),
        apiFetch<Meeting[]>(`/projects/${projectId}/meetings?filter=upcoming`),
      ]);
      setProject(projData);
      setTasks(taskData);
      setMembers(projData.members || []);

      if (meetingsData && meetingsData.length > 0) {
        setNextMeeting(meetingsData[0]);
      } else {
        setNextMeeting(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load project workspace');
    } finally {
      setIsLoading(false);
    }
  };

  const refetchTasks = async () => {
    try {
      const taskData = await apiFetch<Task[]>(`/projects/${projectId}/tasks`);
      setTasks(taskData);
    } catch (err) {
      console.error('[Realtime Resync Error]:', err);
    }
  };

  const refetchMeetings = async () => {
    try {
      const meetingsData = await apiFetch<Meeting[]>(`/projects/${projectId}/meetings?filter=upcoming`);
      if (meetingsData && meetingsData.length > 0) {
        setNextMeeting(meetingsData[0]);
      } else {
        setNextMeeting(null);
      }
    } catch (err) {
      console.error('[Realtime Meetings Refresh Error]:', err);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId]);

  // Hook into Realtime Events
  const { sendTyping } = useProjectRealtime(projectId, {
    onPresenceUpdate: (users) => {
      setOnlineUsers(users);
    },
    onTaskCreated: ({ task, actor }) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
      triggerAnalyticsRefetch();
      if (actor.id !== user?.id) {
        addToast(`${actor.name} added task "${task.title}"`);
      }
    },
    onTaskUpdated: ({ task, actor }) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...task } : t)));
      setSelectedTask((prev) => (prev && prev.id === task.id ? { ...prev, ...task } : prev));
      triggerAnalyticsRefetch();
      if (actor.id !== user?.id) {
        addToast(`${actor.name} updated "${task.title}"`);
      }
    },
    onTaskMoved: ({ task, to_status, affected, actor }) => {
      setTasks((prev) => {
        const affectedMap = new Map(affected.map((a) => [a.id, a]));
        return prev.map((t) => {
          if (t.id === task.id) {
            return { ...t, ...task, status: to_status };
          }
          if (affectedMap.has(t.id)) {
            const aff = affectedMap.get(t.id)!;
            return { ...t, status: aff.status, position: aff.position };
          }
          return t;
        });
      });

      setSelectedTask((prev) => (prev && prev.id === task.id ? { ...prev, ...task, status: to_status } : prev));
      triggerAnalyticsRefetch();

      if (actor.id !== user?.id) {
        setHighlightedTaskId(task.id);
        setTimeout(() => setHighlightedTaskId(null), 1800);
        const colName = to_status === 'DONE' ? 'Done' : to_status === 'IN_PROGRESS' ? 'In Progress' : 'To Do';
        addToast(`${actor.name} moved "${task.title}" to ${colName}`);
      }
    },
    onTaskDeleted: ({ taskId, actor }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask((prev) => {
        if (prev && prev.id === taskId) {
          setIsTaskModalOpen(false);
          addToast(`Task was deleted by ${actor.name}`);
          return null;
        }
        return prev;
      });
      triggerAnalyticsRefetch();
      if (actor.id !== user?.id) {
        addToast(`${actor.name} deleted a task`);
      }
    },
    onCommentCreated: ({ taskId, actor }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, comment_count: (t.comment_count || 0) + 1 } : t))
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev
      );
      setModalRefreshKey((prev) => prev + 1);
      if (actor.id !== user?.id) {
        addToast(`${actor.name} commented on a task`);
      }
    },
    onCommentUpdated: () => {
      setModalRefreshKey((prev) => prev + 1);
    },
    onCommentDeleted: ({ taskId }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, comment_count: Math.max(0, (t.comment_count || 0) - 1) } : t))
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, comment_count: Math.max(0, (prev.comment_count || 0) - 1) } : prev
      );
      setModalRefreshKey((prev) => prev + 1);
    },
    onCommentTyping: ({ taskId, user: typingActor }) => {
      if (selectedTask && selectedTask.id === taskId && typingActor.id !== user?.id) {
        setTypingUser(typingActor.name);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          setTypingUser(null);
        }, 3000);
      }
    },
    onAttachmentAdded: ({ taskId, attachments, actor }) => {
      const count = attachments.length;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, attachment_count: (t.attachment_count || 0) + count } : t))
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, attachment_count: (prev.attachment_count || 0) + count } : prev
      );
      setModalRefreshKey((prev) => prev + 1);
      if (actor.id !== user?.id) {
        addToast(`${actor.name} attached ${count} file(s)`);
      }
    },
    onAttachmentDeleted: ({ taskId }) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, attachment_count: Math.max(0, (t.attachment_count || 0) - 1) } : t))
      );
      setSelectedTask((prev) =>
        prev && prev.id === taskId ? { ...prev, attachment_count: Math.max(0, (prev.attachment_count || 0) - 1) } : prev
      );
      setModalRefreshKey((prev) => prev + 1);
    },
    onMemberAdded: ({ member, actor }) => {
      setMembers((prev) => (prev.some((m) => m.id === member.id) ? prev : [...prev, member]));
      if (actor.id !== user?.id) {
        addToast(`${actor.name} added ${member.name} to project`);
      }
    },
    onMeetingCreated: () => refetchMeetings(),
    onMeetingUpdated: () => refetchMeetings(),
    onMeetingDeleted: () => refetchMeetings(),
    onMeetingStatus: () => refetchMeetings(),
    onSubtaskCreated: ({ taskId, subtask, actor }) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const total = (t.subtask_total || 0) + 1;
            const done = subtask.done ? (t.subtask_done || 0) + 1 : (t.subtask_done || 0);
            return { ...t, subtask_total: total, subtask_done: done };
          }
          return t;
        })
      );
      setModalRefreshKey((prev) => prev + 1);
      triggerAnalyticsRefetch();
      if (actor.id !== user?.id) {
        addToast(`${actor.name} added a checklist item`);
      }
    },
    onSubtaskUpdated: () => {
      refetchTasks();
      setModalRefreshKey((prev) => prev + 1);
      triggerAnalyticsRefetch();
    },
    onSubtaskDeleted: ({ taskId }) => {
      refetchTasks();
      setModalRefreshKey((prev) => prev + 1);
      triggerAnalyticsRefetch();
    },
    onReconnect: () => {
      refetchTasks();
      triggerAnalyticsRefetch();
    },
  });

  const setTab = (tabName: 'board' | 'meetings' | 'analytics') => {
    router.push(`/projects/${projectId}?tab=${tabName}`);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setTaskModalInitialTab('details');
    setIsTaskModalOpen(true);
  };

  const handleOpenComments = (task: Task) => {
    setSelectedTask(task);
    setTaskModalInitialTab('comments');
    setIsTaskModalOpen(true);
  };

  const handleOpenFiles = (task: Task) => {
    setSelectedTask(task);
    setTaskModalInitialTab('files');
    setIsTaskModalOpen(true);
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask]);
  };

  const handleTaskUpdated = (updatedTask: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
    setSelectedTask((prev) => (prev && prev.id === updatedTask.id ? { ...prev, ...updatedTask } : prev));
  };

  const handleTaskDeleted = (deletedTaskId: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedTaskId));
  };

  const handleCloseTaskModal = () => {
    setIsTaskModalOpen(false);
    setSelectedTask(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has('task')) {
      params.delete('task');
      const newQueryStr = params.toString();
      router.replace(`${pathname}${newQueryStr ? `?${newQueryStr}` : ''}`, { scroll: false });
    }
  };

  // Filter evaluation logic
  const isFiltered = Boolean(
    boardFilters.searchQuery ||
    boardFilters.priorities.length > 0 ||
    boardFilters.assignees.length > 0 ||
    boardFilters.due !== 'all' ||
    boardFilters.myTasksOnly
  );

  const filterTasks = (allTasksList: Task[], filters: BoardFilterState): Task[] => {
    if (!isFiltered) return allTasksList;

    const todayStr = new Date().toISOString().split('T')[0];
    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const in7DaysStr = in7Days.toISOString().split('T')[0];

    const searchQ = filters.searchQuery.toLowerCase();

    return allTasksList.filter((t) => {
      // 1. Search Query
      if (searchQ) {
        const matchTitle = t.title.toLowerCase().includes(searchQ);
        const matchDesc = t.description ? t.description.toLowerCase().includes(searchQ) : false;
        if (!matchTitle && !matchDesc) return false;
      }

      // 2. Priority
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(t.priority)) return false;
      }

      // 3. Assignees
      if (filters.assignees.length > 0) {
        const matchUnassigned = filters.assignees.includes('none') && t.assignee_id === null;
        const matchUser = t.assignee_id !== null && filters.assignees.includes(String(t.assignee_id));
        if (!matchUnassigned && !matchUser) return false;
      }

      // 4. My Tasks Only
      if (filters.myTasksOnly && user) {
        if (t.assignee_id !== user.id) return false;
      }

      // 5. Due Date
      if (filters.due && filters.due !== 'all') {
        if (!t.due_date) {
          if (filters.due !== 'nodue') return false;
        } else {
          const dateStr = new Date(t.due_date).toISOString().split('T')[0];
          if (filters.due === 'nodue') return false;
          if (filters.due === 'overdue' && !(dateStr < todayStr && t.status !== 'DONE')) return false;
          if (filters.due === 'today' && dateStr !== todayStr) return false;
          if (filters.due === 'next7' && !(dateStr >= todayStr && dateStr <= in7DaysStr)) return false;
        }
      }

      return true;
    });
  };

  const filteredTasks = filterTasks(tasks, boardFilters);
  const isOwner = project?.current_user_role === 'OWNER';

  // Calculate Next Meeting Chip time text
  const getNextMeetingTimeText = (m: Meeting) => {
    const scheduledDate = new Date(m.scheduled_at);
    const now = new Date();
    const diffMs = scheduledDate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (m.status === 'LIVE') return 'LIVE NOW';
    if (diffMins <= 0) return 'starting now';
    if (diffHours >= 24) return `in ${Math.floor(diffHours / 24)}d`;
    if (diffHours > 0) return `in ${diffHours}h ${diffMins % 60}m`;
    return `in ${diffMins}m`;
  };

  return (
    <div className="min-h-screen bg-app-bg flex flex-col relative">
      <Navbar />

      {/* Floating Bottom-Left Toasts */}
      <RealtimeToast toasts={toasts} onDismiss={removeToast} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-semibold text-app-text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Projects</span>
          </Link>
        </div>

        {/* Header Bar */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-app-text-muted space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">Loading project workspace...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-4 rounded-xl text-xs flex justify-between items-center">
            <span>{error}</span>
            <button onClick={fetchProjectData} className="underline font-semibold">Retry</button>
          </div>
        ) : project ? (
          <>
            <div className="bg-surface rounded-xl border border-app-border p-6 shadow-soft space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold text-app-text tracking-tight font-heading">
                      {project.title}
                    </h1>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-[#FFF1D6] text-[#A8680F]">
                      {project.current_user_role || 'MEMBER'}
                    </span>

                    {/* Next Meeting Header Chip */}
                    {nextMeeting && (
                      <button
                        onClick={() => setTab('meetings')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary hover:bg-primary/20 transition-colors shadow-2xs"
                        title="Click to open Meetings tab"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>
                          Next meeting: <strong>{nextMeeting.title}</strong> ({getNextMeetingTimeText(nextMeeting)})
                        </span>
                      </button>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-app-text-muted max-w-2xl">
                      {project.description}
                    </p>
                  )}
                </div>

                {/* Right Header Actions & Presence */}
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Presence Online Indicator & Avatars */}
                  <div className="flex items-center gap-2 bg-surface-soft/80 border border-app-border px-3 py-1.5 rounded-xl">
                    <div className="flex items-center -space-x-2 overflow-hidden">
                      {members.map((m) => {
                        const isOnline = onlineUsers.some((u) => u.id === m.id);
                        return (
                          <div key={m.id} className="relative group" title={`${m.name} (${isOnline ? 'Online' : 'Offline'})`}>
                            <Avatar
                              name={m.name}
                              size="md"
                              className={`ring-2 ring-surface ${isOnline ? '' : 'opacity-40 grayscale'}`}
                            />
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#2E7D4F] ring-2 ring-white" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-xs font-semibold text-[#2E7D4F] flex items-center gap-1.5 pl-1">
                      <span className="w-2 h-2 rounded-full bg-[#2E7D4F] animate-pulse" />
                      <span>{onlineUsers.length} online</span>
                    </span>
                  </div>

                  {/* Add Member (Owner only) */}
                  {isOwner && (
                    <button
                      onClick={() => setIsAddMemberModalOpen(true)}
                      className="p-2 border border-app-border hover:border-primary text-app-text-muted hover:text-primary rounded-lg transition-colors bg-surface-soft"
                      title="Add team member"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}

                  {/* Add Task Button (when on board tab) */}
                  {activeTab === 'board' && (
                    <button
                      onClick={() => setIsCreateTaskModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Task</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs Header Navigation */}
              <div className="flex items-center gap-2 border-t border-app-border pt-4">
                <button
                  onClick={() => setTab('board')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'board'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Board</span>
                </button>

                <button
                  onClick={() => setTab('meetings')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'meetings'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>Meetings</span>
                  {nextMeeting && activeTab !== 'meetings' && (
                    <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                  )}
                </button>

                <button
                  onClick={() => setTab('analytics')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === 'analytics'
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Analytics</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'board' ? (
              /* Kanban Board Tab */
              <div className="pt-2">
                {/* Board Filter Toolbar */}
                <BoardFilterToolbar
                  ref={toolbarRef}
                  members={members}
                  currentUser={user}
                  onFilterChange={setBoardFilters}
                  isFiltered={isFiltered}
                  onClearFilters={() =>
                    setBoardFilters({
                      searchQuery: '',
                      priorities: [],
                      assignees: [],
                      due: 'all',
                      myTasksOnly: false,
                    })
                  }
                />

                <KanbanBoard
                  tasks={filteredTasks}
                  allTasks={tasks}
                  isFiltered={isFiltered}
                  searchQuery={boardFilters.searchQuery}
                  onClearFilters={() =>
                    setBoardFilters({
                      searchQuery: '',
                      priorities: [],
                      assignees: [],
                      due: 'all',
                      myTasksOnly: false,
                    })
                  }
                  onTasksChange={setTasks}
                  onTaskClick={handleTaskClick}
                  onOpenComments={handleOpenComments}
                  onOpenFiles={handleOpenFiles}
                  onAddTaskClick={() => setIsCreateTaskModalOpen(true)}
                  highlightedTaskId={highlightedTaskId}
                />
              </div>
            ) : activeTab === 'meetings' ? (
              /* Meetings Tab */
              <div className="pt-2">
                <MeetingsList projectId={projectId} members={members} />
              </div>
            ) : (
              /* Analytics Tab */
              <div className="pt-2">
                <AnalyticsTab projectId={projectId} realtimeRefreshKey={analyticsRefreshKey} />
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* Task Details & Edit Modal */}
      <TaskModal
        task={selectedTask}
        members={members}
        currentUserRole={project?.current_user_role}
        initialTab={taskModalInitialTab}
        isOpen={isTaskModalOpen}
        onClose={handleCloseTaskModal}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
        typingUser={typingUser}
        onTyping={() => selectedTask && sendTyping(selectedTask.id)}
        realtimeRefreshKey={modalRefreshKey}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={projectId}
        members={members}
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onTaskCreated={handleTaskCreated}
      />

      {/* Add Member Modal */}
      <AddMemberModal
        projectId={projectId}
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onMembersUpdated={(updated) => setMembers(updated)}
      />
    </div>
  );
}

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-app-bg flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ProjectDetailsContent params={params} />
    </React.Suspense>
  );
}
