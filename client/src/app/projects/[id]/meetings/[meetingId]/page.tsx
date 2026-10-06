'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { apiFetch } from '@/lib/api';
import { JoinMeetingResponse, Meeting, ProjectMember, Task, TaskPriority } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Video,
  FileText,
  ListTodo,
  Plus,
  Loader2,
  PhoneOff,
  ChevronRight,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';

export default function MeetingRoomPage({
  params,
}: {
  params: Promise<{ id: string; meetingId: string }>;
}) {
  const resolvedParams = use(params);
  const projectId = parseInt(resolvedParams.id, 10);
  const meetingId = parseInt(resolvedParams.meetingId, 10);
  const { user } = useAuth();
  const router = useRouter();

  const [joinData, setJoinData] = useState<JoinMeetingResponse | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Side Panel state
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Action Items state
  const [actionTitle, setActionTitle] = useState('');
  const [actionPriority, setActionPriority] = useState<TaskPriority>('MEDIUM');
  const [actionAssigneeId, setActionAssigneeId] = useState<number | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Task[]>([]);
  const [addingAction, setAddingAction] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // JaaS iframe container ref
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);

  const fetchMeetingData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [jData, projData] = await Promise.all([
        apiFetch<JoinMeetingResponse>(`/meetings/${meetingId}/join`),
        apiFetch<any>(`/projects/${projectId}`),
      ]);
      setJoinData(jData);
      setMeeting(jData.meeting);
      setNotes(jData.meeting.notes || '');
      setMembers(projData.members || []);
    } catch (err: any) {
      setError(err.message || 'Failed to join meeting');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId && projectId) {
      fetchMeetingData();
    }
  }, [meetingId, projectId]);

  // Debounced Autosave for Meeting Notes
  useEffect(() => {
    if (!meeting || notes === (meeting.notes || '')) return;

    const timer = setTimeout(async () => {
      setSavingNotes(true);
      try {
        await apiFetch(`/meetings/${meetingId}`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
        setMeeting((prev) => (prev ? { ...prev, notes } : prev));
      } catch (err) {
        console.error('Failed to autosave notes:', err);
      } finally {
        setSavingNotes(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notes, meetingId, meeting]);

  // JaaS iFrame Initialization when JaaS script loads
  const handleJaaSScriptLoad = () => {
    if (!joinData || joinData.provider !== 'jaas' || !jitsiContainerRef.current) return;

    try {
      const domain = '8x8.vc';
      const options = {
        roomName: `${joinData.appId}/${joinData.roomName}`,
        jwt: joinData.jwt,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: user?.name || 'Guest User',
          email: user?.email || '',
        },
      };

      const api = new (window as any).JitsiMeetExternalAPI(domain, options);
      apiRef.current = api;

      api.addEventListener('videoConferenceLeft', () => {
        router.push(`/projects/${projectId}?tab=meetings`);
      });
    } catch (err) {
      console.error('Failed to initialize JaaS iFrame:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, []);

  const handleCopyLink = () => {
    if (!joinData) return;
    navigator.clipboard.writeText(joinData.joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAddActionItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionTitle.trim()) return;

    setAddingAction(true);
    setActionSuccessMsg(null);

    try {
      const newTask = await apiFetch<Task>(`/meetings/${meetingId}/action-items`, {
        method: 'POST',
        body: JSON.stringify({
          title: actionTitle,
          priority: actionPriority,
          assignee_id: actionAssigneeId,
        }),
      });

      setCreatedTasks((prev) => [newTask, ...prev]);
      setActionTitle('');
      setActionSuccessMsg(`Task #${newTask.id} added to TODO column!`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to create action item task');
    } finally {
      setAddingAction(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!confirm('Are you sure you want to end this meeting for all participants?')) return;
    try {
      await apiFetch(`/meetings/${meetingId}/end`, { method: 'POST' });
      router.push(`/projects/${projectId}?tab=meetings`);
    } catch (err: any) {
      alert(err.message || 'Failed to end meeting');
    }
  };

  const isCreator = user && meeting?.created_by === user.id;

  return (
    <div className="min-h-screen bg-app-bg flex flex-col">
      <Navbar />

      {/* Script tag for 8x8 JaaS iframe if provider is jaas */}
      {joinData?.provider === 'jaas' && joinData.appId && (
        <Script
          src={`https://8x8.vc/${joinData.appId}/external_api.js`}
          onLoad={handleJaaSScriptLoad}
        />
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col space-y-4">
        {/* Top Breadcrumb & Actions Bar */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-app-border">
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${projectId}?tab=meetings`}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg hover:bg-surface-soft transition-colors"
              title="Back to Meetings"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <h1 className="text-lg font-bold text-app-text font-heading line-clamp-1">
                {meeting?.title || 'Video Meeting'}
              </h1>
              <p className="text-xs text-app-text-muted">
                {joinData?.provider === 'jaas' ? 'Secure JaaS HD Video Room' : 'Public Jitsi Video Room'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-surface-soft hover:bg-primary-soft border border-app-border text-xs font-semibold text-app-text hover:text-primary rounded-lg transition-colors flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-[#5DB67A]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>

            {isCreator && meeting?.status !== 'ENDED' && (
              <button
                onClick={handleEndMeeting}
                className="px-3 py-1.5 bg-[#FBDAD8] hover:bg-[#FBDAD8]/80 text-[#B4413C] font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Meeting</span>
              </button>
            )}

            <button
              onClick={() => setIsSidePanelOpen(!isSidePanelOpen)}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg hover:bg-surface-soft transition-colors"
              title={isSidePanelOpen ? 'Collapse Notes' : 'Expand Notes'}
            >
              {isSidePanelOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-app-text-muted space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">Connecting to video room...</p>
          </div>
        ) : error ? (
          <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-4 rounded-xl text-xs flex justify-between items-center">
            <span>{error}</span>
            <Link href={`/projects/${projectId}?tab=meetings`} className="underline font-semibold">
              Return to meetings
            </Link>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[600px]">
            {/* Video Stream Area */}
            <div className="flex-1 bg-surface rounded-xl border border-app-border shadow-soft overflow-hidden flex flex-col min-h-[450px]">
              {joinData?.provider === 'jaas' ? (
                /* JaaS Embedded Iframe */
                <div ref={jitsiContainerRef} className="w-full h-full min-h-[500px] bg-black" />
              ) : (
                /* Jitsi Public Fallback Card */
                <div className="my-auto p-8 sm:p-12 max-w-lg mx-auto text-center space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto shadow-soft">
                    <Video className="w-8 h-8" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-app-text font-heading">
                      Ready to join video meeting?
                    </h2>
                    <p className="text-xs text-app-text-muted">
                      Room name: <code className="bg-surface-soft px-2 py-0.5 rounded font-mono">{joinData?.roomName}</code>
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <a
                      href={joinData?.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary-hover text-white font-semibold text-sm rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open Meeting in New Tab</span>
                    </a>

                    <button
                      onClick={handleCopyLink}
                      className="w-full sm:w-auto px-4 py-3 bg-surface-soft border border-app-border text-app-text font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-[#5DB67A]" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-app-text-muted bg-surface-soft/60 p-3 rounded-lg border border-app-border/40">
                    💡 Tip: Keep this window open so you can take live meeting notes and convert discussion topics into Kanban tasks.
                  </p>
                </div>
              )}
            </div>

            {/* Side Panel: Shared Notes & Action Items */}
            {isSidePanelOpen && (
              <div className="w-full lg:w-96 bg-surface rounded-xl border border-app-border p-5 shadow-soft flex flex-col space-y-6 overflow-y-auto max-h-[700px]">
                {/* Section 1: Shared Meeting Notes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-app-text">
                      <FileText className="w-4 h-4 text-primary" />
                      <span>Shared Meeting Notes</span>
                    </div>
                    {savingNotes && (
                      <span className="text-[10px] text-primary font-semibold animate-pulse">
                        Autosaving...
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={6}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type shared notes, key takeaways, or decisions..."
                    className="w-full p-3 bg-surface-soft border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
                  />
                </div>

                {/* Section 2: Action Items to Task Conversion */}
                <div className="space-y-3 pt-4 border-t border-app-border">
                  <div className="flex items-center gap-2 text-xs font-bold text-app-text">
                    <ListTodo className="w-4 h-4 text-primary" />
                    <span>Convert Action Item to Task</span>
                  </div>

                  {actionSuccessMsg && (
                    <div className="bg-[#D9F0DF] border border-[#2E7D4F]/30 text-[#2E7D4F] p-2.5 rounded-lg text-xs flex items-center gap-2 font-semibold">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>{actionSuccessMsg}</span>
                    </div>
                  )}

                  <form onSubmit={handleAddActionItem} className="space-y-3 bg-surface-soft/60 p-3 rounded-lg border border-app-border/60">
                    <div>
                      <input
                        type="text"
                        required
                        value={actionTitle}
                        onChange={(e) => setActionTitle(e.target.value)}
                        placeholder="Action item title..."
                        className="w-full px-3 py-2 bg-surface border border-app-border rounded-lg text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={actionPriority}
                        onChange={(e) => setActionPriority(e.target.value as TaskPriority)}
                        className="w-full px-2 py-1.5 bg-surface border border-app-border rounded-lg text-xs text-app-text"
                      >
                        <option value="LOW">LOW</option>
                        <option value="MEDIUM">MEDIUM</option>
                        <option value="HIGH">HIGH</option>
                      </select>

                      <select
                        value={actionAssigneeId === null ? '' : actionAssigneeId}
                        onChange={(e) => setActionAssigneeId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full px-2 py-1.5 bg-surface border border-app-border rounded-lg text-xs text-app-text"
                      >
                        <option value="">Unassigned</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={addingAction || !actionTitle.trim()}
                      className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-70"
                    >
                      {addingAction ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Add to TODO Board</span>
                    </button>
                  </form>

                  {/* Created Action Items List */}
                  {createdTasks.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <p className="text-[11px] font-semibold text-app-text-muted">Created in this meeting:</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {createdTasks.map((t) => (
                          <div
                            key={t.id}
                            className="bg-surface p-2.5 rounded-lg border border-app-border text-xs flex items-center justify-between gap-2 shadow-xs"
                          >
                            <span className="font-semibold text-app-text truncate">{t.title}</span>
                            <Link
                              href={`/projects/${projectId}`}
                              className="text-[10px] font-bold text-primary hover:underline shrink-0"
                            >
                              View on board
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
