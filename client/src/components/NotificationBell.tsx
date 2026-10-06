'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSocket } from '@/lib/socket-context';
import { Notification, NotificationPreferences, NotificationType } from '@/lib/types';
import {
  Bell,
  CheckCheck,
  Settings,
  UserPlus,
  Clock,
  AlertTriangle,
  MessageSquare,
  FolderPlus,
  Video,
  X,
  Check,
} from 'lucide-react';

export const NotificationBell: React.FC = () => {
  const router = useRouter();
  const { socket } = useSocket();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  // Preferences Modal state
  const [showPrefModal, setShowPrefModal] = useState<boolean>(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Fetch initial unread count
  useEffect(() => {
    fetchUnreadCount();
  }, []);

  // Listen to Socket.io real-time notifications
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (data: { notification: Notification; unread_count: number }) => {
      setUnreadCount(data.unread_count);
      setNotifications((prev) => [data.notification, ...prev]);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket]);

  // Fetch notifications when popover opens or tab changes
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, activeTab]);

  // Click outside listener for popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch<{ unread_count: number }>('/notifications/unread-count');
      setUnreadCount(res.unread_count);
    } catch (err) {
      console.error('Failed to fetch unread notification count:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const query = activeTab === 'unread' ? '?unread_only=true' : '';
      const res = await apiFetch<{ notifications?: Notification[]; unread_count?: number } | Notification[]>(
        `/notifications${query}`
      );
      if (Array.isArray(res)) {
        setNotifications(res);
      } else if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        if (typeof res.unread_count === 'number') {
          setUnreadCount(res.unread_count);
        }
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notif: Notification) => {
    if (!notif.read_at) {
      try {
        await apiFetch(`/notifications/${notif.id}/read`, { method: 'PATCH' });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }

    if (notif.link) {
      setIsOpen(false);
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const handleOpenPreferences = async () => {
    try {
      const p = await apiFetch<NotificationPreferences>('/notification-preferences');
      setPrefs(p);
      setShowPrefModal(true);
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    try {
      setSavingPrefs(true);
      const updated = await apiFetch<NotificationPreferences>('/notification-preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          in_app_enabled: prefs.in_app_enabled,
          email_enabled: prefs.email_enabled,
          email_on_assigned: prefs.email_on_assigned,
          email_on_due: prefs.email_on_due,
          email_on_comment: prefs.email_on_comment,
        }),
      });
      setPrefs(updated);
      setShowPrefModal(false);
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  };

  const getNotifIcon = (type: NotificationType) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'TASK_DUE_SOON':
        return <Clock className="w-4 h-4 text-[#A8680F]" />;
      case 'TASK_OVERDUE':
        return <AlertTriangle className="w-4 h-4 text-feedback-error" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'ADDED_TO_PROJECT':
        return <FolderPlus className="w-4 h-4 text-primary" />;
      case 'MEETING_INVITE':
        return <Video className="w-4 h-4 text-accent" />;
      default:
        return <Bell className="w-4 h-4 text-app-text-muted" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-app-text-muted hover:text-primary hover:bg-surface-soft rounded-lg transition-colors focus:outline-none"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-feedback-error rounded-full ring-2 ring-surface shadow-xs animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface rounded-2xl border border-app-border shadow-soft-xl z-50 overflow-hidden flex flex-col max-h-[520px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-app-border flex items-center justify-between bg-surface-soft/40">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-sm text-app-text">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="p-1.5 text-xs font-medium text-app-text-muted hover:text-primary hover:bg-surface rounded-lg transition-colors flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
              <button
                onClick={handleOpenPreferences}
                className="p-1.5 text-app-text-muted hover:text-app-text hover:bg-surface rounded-lg transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-app-border px-4 pt-2 gap-4 bg-surface text-xs font-medium text-app-text-muted">
            <button
              onClick={() => setActiveTab('all')}
              className={`pb-2 border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent hover:text-app-text'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('unread')}
              className={`pb-2 border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === 'unread'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent hover:text-app-text'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-feedback-error" />
              )}
            </button>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-app-border/60">
            {loading ? (
              <div className="p-8 text-center text-xs text-app-text-muted">Loading notifications...</div>
            ) : !Array.isArray(notifications) || notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-app-text-muted/40 mx-auto mb-2" />
                <p className="text-xs font-medium text-app-text-muted">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors hover:bg-surface-soft/80 ${
                      isUnread ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-surface border border-app-border shrink-0 shadow-xs">
                      {getNotifIcon(n.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs ${isUnread ? 'font-semibold text-app-text' : 'font-medium text-app-text-muted'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-app-text-muted whitespace-nowrap shrink-0">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>

                      {n.body && (
                        <p className="text-[11px] text-app-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      )}
                    </div>

                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Preferences Modal */}
      {showPrefModal && prefs && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl border border-app-border shadow-soft-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-app-border">
              <h3 className="font-heading font-bold text-base text-app-text">Notification Preferences</h3>
              <button
                onClick={() => setShowPrefModal(false)}
                className="p-1 text-app-text-muted hover:text-app-text rounded-lg hover:bg-surface-soft transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePreferences} className="mt-4 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl border border-app-border hover:bg-surface-soft/40 cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-app-text block">In-App Notifications</span>
                    <span className="text-[11px] text-app-text-muted block">Show notifications in the top navbar bell</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.in_app_enabled}
                    onChange={(e) => setPrefs({ ...prefs, in_app_enabled: e.target.checked })}
                    className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-app-border hover:bg-surface-soft/40 cursor-pointer">
                  <div>
                    <span className="text-xs font-semibold text-app-text block">Email Notifications</span>
                    <span className="text-[11px] text-app-text-muted block">Master toggle to receive email updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.email_enabled}
                    onChange={(e) => setPrefs({ ...prefs, email_enabled: e.target.checked })}
                    className="w-4 h-4 text-primary border-app-border rounded focus:ring-primary"
                  />
                </label>

                {prefs.email_enabled && (
                  <div className="pl-4 space-y-2.5 border-l-2 border-primary/20 pt-1">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-app-text font-medium">Email when assigned to a task</span>
                      <input
                        type="checkbox"
                        checked={prefs.email_on_assigned}
                        onChange={(e) => setPrefs({ ...prefs, email_on_assigned: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary border-app-border rounded focus:ring-primary"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-app-text font-medium">Email on due & overdue reminders</span>
                      <input
                        type="checkbox"
                        checked={prefs.email_on_due}
                        onChange={(e) => setPrefs({ ...prefs, email_on_due: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary border-app-border rounded focus:ring-primary"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-app-text font-medium">Email when someone comments</span>
                      <input
                        type="checkbox"
                        checked={prefs.email_on_comment}
                        onChange={(e) => setPrefs({ ...prefs, email_on_comment: e.target.checked })}
                        className="w-3.5 h-3.5 text-primary border-app-border rounded focus:ring-primary"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-app-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrefModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-app-text-muted hover:bg-surface-soft rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrefs}
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:opacity-90 rounded-xl transition-opacity flex items-center gap-1.5 shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{savingPrefs ? 'Saving...' : 'Save Preferences'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
