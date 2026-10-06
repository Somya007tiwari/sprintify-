'use client';

import { useEffect, useRef } from 'react';
import { useSocket } from './socket-context';
import {
  Task,
  Subtask,
  Comment,
  Attachment,
  Meeting,
  Actor,
  OnlineUser,
  TaskMovedPayload,
  MeetingStatus,
} from './types';

export interface RealtimeHandlers {
  onPresenceUpdate?: (users: OnlineUser[]) => void;
  onTaskCreated?: (payload: { task: Task; actor: Actor }) => void;
  onTaskUpdated?: (payload: { task: Task; actor: Actor }) => void;
  onTaskMoved?: (payload: TaskMovedPayload) => void;
  onTaskDeleted?: (payload: { taskId: number; actor: Actor }) => void;
  onCommentCreated?: (payload: { taskId: number; comment: Comment; actor: Actor }) => void;
  onCommentUpdated?: (payload: { taskId: number; comment: Comment; actor: Actor }) => void;
  onCommentDeleted?: (payload: { taskId: number; commentId: number; actor: Actor }) => void;
  onCommentTyping?: (payload: { taskId: number; user: Actor }) => void;
  onAttachmentAdded?: (payload: { taskId: number; attachments: Attachment[]; actor: Actor }) => void;
  onAttachmentDeleted?: (payload: { taskId: number; attachmentId: number; actor: Actor }) => void;
  onMemberAdded?: (payload: { member: any; actor: Actor }) => void;
  onMeetingCreated?: (payload: { meeting: Meeting; actor: Actor }) => void;
  onMeetingUpdated?: (payload: { meeting: Meeting; actor: Actor }) => void;
  onMeetingDeleted?: (payload: { meetingId: number; actor: Actor }) => void;
  onMeetingStatus?: (payload: { meetingId: number; status: MeetingStatus; meeting: Meeting; actor: Actor }) => void;
  onSubtaskCreated?: (payload: { taskId: number; subtask: Subtask; actor: Actor }) => void;
  onSubtaskUpdated?: (payload: { taskId: number; subtask: Subtask; actor: Actor }) => void;
  onSubtaskDeleted?: (payload: { taskId: number; subtaskId: number; actor: Actor }) => void;
  onReconnect?: () => void;
}

export function useProjectRealtime(projectId: number | null, handlers: RealtimeHandlers) {
  const { socket, connected } = useSocket();
  const handlersRef = useRef(handlers);
  const isFirstConnectRef = useRef(true);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!socket || !connected || !projectId) return;

    // Function to join room
    const joinRoom = () => {
      socket.emit('project:join', { projectId }, (ack: { ok: boolean; error?: string }) => {
        if (!ack.ok) {
          console.warn('[Realtime] Failed to join project room:', ack.error);
        }
      });
    };

    // Join room initially
    joinRoom();

    // Listen for reconnection
    const handleConnect = () => {
      joinRoom();
      if (!isFirstConnectRef.current) {
        if (handlersRef.current.onReconnect) {
          handlersRef.current.onReconnect();
        }
      }
      isFirstConnectRef.current = false;
    };

    socket.on('connect', handleConnect);

    // Register event listeners
    const handlePresenceUpdate = (data: { projectId: number; users: OnlineUser[] }) => {
      if (data.projectId === projectId && handlersRef.current.onPresenceUpdate) {
        handlersRef.current.onPresenceUpdate(data.users);
      }
    };

    const handleTaskCreated = (data: { task: Task; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onTaskCreated) {
        handlersRef.current.onTaskCreated(data);
      }
    };

    const handleTaskUpdated = (data: { task: Task; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onTaskUpdated) {
        handlersRef.current.onTaskUpdated(data);
      }
    };

    const handleTaskMoved = (data: TaskMovedPayload) => {
      if (data.projectId === projectId && handlersRef.current.onTaskMoved) {
        handlersRef.current.onTaskMoved(data);
      }
    };

    const handleTaskDeleted = (data: { taskId: number; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onTaskDeleted) {
        handlersRef.current.onTaskDeleted(data);
      }
    };

    const handleCommentCreated = (data: { taskId: number; comment: Comment; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onCommentCreated) {
        handlersRef.current.onCommentCreated(data);
      }
    };

    const handleCommentUpdated = (data: { taskId: number; comment: Comment; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onCommentUpdated) {
        handlersRef.current.onCommentUpdated(data);
      }
    };

    const handleCommentDeleted = (data: { taskId: number; commentId: number; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onCommentDeleted) {
        handlersRef.current.onCommentDeleted(data);
      }
    };

    const handleCommentTyping = (data: { taskId: number; user: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onCommentTyping) {
        handlersRef.current.onCommentTyping(data);
      }
    };

    const handleAttachmentAdded = (data: { taskId: number; attachments: Attachment[]; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onAttachmentAdded) {
        handlersRef.current.onAttachmentAdded(data);
      }
    };

    const handleAttachmentDeleted = (data: { taskId: number; attachmentId: number; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onAttachmentDeleted) {
        handlersRef.current.onAttachmentDeleted(data);
      }
    };

    const handleMemberAdded = (data: { member: any; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onMemberAdded) {
        handlersRef.current.onMemberAdded(data);
      }
    };

    const handleMeetingCreated = (data: { meeting: Meeting; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onMeetingCreated) {
        handlersRef.current.onMeetingCreated(data);
      }
    };

    const handleMeetingUpdated = (data: { meeting: Meeting; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onMeetingUpdated) {
        handlersRef.current.onMeetingUpdated(data);
      }
    };

    const handleMeetingDeleted = (data: { meetingId: number; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onMeetingDeleted) {
        handlersRef.current.onMeetingDeleted(data);
      }
    };

    const handleMeetingStatus = (data: { meetingId: number; status: MeetingStatus; meeting: Meeting; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onMeetingStatus) {
        handlersRef.current.onMeetingStatus(data);
      }
    };

    const handleSubtaskCreated = (data: { taskId: number; subtask: Subtask; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onSubtaskCreated) {
        handlersRef.current.onSubtaskCreated(data);
      }
    };

    const handleSubtaskUpdated = (data: { taskId: number; subtask: Subtask; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onSubtaskUpdated) {
        handlersRef.current.onSubtaskUpdated(data);
      }
    };

    const handleSubtaskDeleted = (data: { taskId: number; subtaskId: number; actor: Actor; projectId: number }) => {
      if (data.projectId === projectId && handlersRef.current.onSubtaskDeleted) {
        handlersRef.current.onSubtaskDeleted(data);
      }
    };

    socket.on('presence:update', handlePresenceUpdate);
    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:moved', handleTaskMoved);
    socket.on('task:deleted', handleTaskDeleted);
    socket.on('comment:created', handleCommentCreated);
    socket.on('comment:updated', handleCommentUpdated);
    socket.on('comment:deleted', handleCommentDeleted);
    socket.on('comment:typing', handleCommentTyping);
    socket.on('attachment:added', handleAttachmentAdded);
    socket.on('attachment:deleted', handleAttachmentDeleted);
    socket.on('member:added', handleMemberAdded);
    socket.on('meeting:created', handleMeetingCreated);
    socket.on('meeting:updated', handleMeetingUpdated);
    socket.on('meeting:deleted', handleMeetingDeleted);
    socket.on('meeting:status', handleMeetingStatus);
    socket.on('subtask:created', handleSubtaskCreated);
    socket.on('subtask:updated', handleSubtaskUpdated);
    socket.on('subtask:deleted', handleSubtaskDeleted);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:moved', handleTaskMoved);
      socket.off('task:deleted', handleTaskDeleted);
      socket.off('comment:created', handleCommentCreated);
      socket.off('comment:updated', handleCommentUpdated);
      socket.off('comment:deleted', handleCommentDeleted);
      socket.off('comment:typing', handleCommentTyping);
      socket.off('attachment:added', handleAttachmentAdded);
      socket.off('attachment:deleted', handleAttachmentDeleted);
      socket.off('member:added', handleMemberAdded);
      socket.off('meeting:created', handleMeetingCreated);
      socket.off('meeting:updated', handleMeetingUpdated);
      socket.off('meeting:deleted', handleMeetingDeleted);
      socket.off('meeting:status', handleMeetingStatus);
      socket.off('subtask:created', handleSubtaskCreated);
      socket.off('subtask:updated', handleSubtaskUpdated);
      socket.off('subtask:deleted', handleSubtaskDeleted);

      socket.emit('project:leave', { projectId });
    };
  }, [socket, connected, projectId]);

  const sendTyping = (taskId: number) => {
    if (socket && connected && projectId) {
      socket.emit('comment:typing', { projectId, taskId });
    }
  };

  return { sendTyping };
}
