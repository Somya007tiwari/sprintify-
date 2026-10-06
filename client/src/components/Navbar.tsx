'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket-context';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import { CommandPalette } from './CommandPalette';
import { LogOut, LayoutGrid, Layers, Search } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="bg-surface border-b border-app-border sticky top-0 z-30 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <Layers className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-app-text tracking-tight font-heading">
              Sprintify
            </span>
          </Link>

          {/* User / Actions */}
          {user && (
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Global Search Command Palette Button */}
              <button
                onClick={() => setIsPaletteOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface-soft hover:bg-surface border border-app-border text-app-text-muted hover:text-app-text rounded-xl text-xs font-medium transition-colors shadow-xs"
                title="Search projects & tasks (Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-surface border border-app-border text-app-text-muted rounded-md shadow-xs">
                  {isMac ? '⌘K' : 'Ctrl K'}
                </kbd>
              </button>

              {/* Live Connection Status Badge */}
              <div
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                  connected
                    ? 'bg-[#E3EFE6]/70 border-[#2E7D4F]/30 text-[#2E7D4F]'
                    : 'bg-[#FDF3E3]/70 border-[#A8680F]/30 text-[#A8680F]'
                }`}
                title={connected ? 'Real-time sync connected' : 'Reconnecting to real-time server...'}
              >
                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#2E7D4F] animate-pulse' : 'bg-[#A8680F]'}`} />
                <span className="font-semibold">
                  {connected ? 'Live Sync' : 'Reconnecting'}
                </span>
              </div>

              {/* Notification Bell */}
              <NotificationBell />

              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs font-semibold text-app-text-muted hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-soft"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
              </Link>

              <div className="h-4 w-px bg-app-border" />

              <div className="flex items-center gap-2.5">
                <Avatar name={user.name} size="md" />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-app-text leading-none">{user.name}</p>
                  <p className="text-[11px] text-app-text-muted mt-0.5 leading-none">{user.email}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-2 text-app-text-muted hover:text-feedback-error hover:bg-[#FBDAD8]/40 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Global Command Palette */}
      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
    </>
  );
};
