'use client';

import React from 'react';
import { X, Bell } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
}

interface RealtimeToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const RealtimeToast: React.FC<RealtimeToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col space-y-2 max-w-xs sm:max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-surface border border-primary/30 rounded-xl shadow-soft-lg p-3 text-xs font-semibold text-app-text flex items-center justify-between gap-3 transition-all duration-200 border-l-4 border-l-primary"
        >
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary shrink-0 animate-bounce" />
            <span className="line-clamp-2">{toast.message}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-app-text-muted hover:text-app-text hover:bg-black/5 rounded-md transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
