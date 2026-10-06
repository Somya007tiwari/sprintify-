'use client';

import React, { useState } from 'react';
import { AiAssistResponse, TaskPriority } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { PriorityBadge } from './PriorityBadge';
import { Sparkles, Loader2, RefreshCw, Check, X, AlertCircle, Bug, CheckSquare } from 'lucide-react';

interface AiAssistModalProps {
  projectId: number;
  title: string;
  existingDescription?: string;
  mode?: 'GENERATE' | 'IMPROVE' | 'SUBTASKS_ONLY';
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: { description: string; subtasks: string[]; priority?: TaskPriority }, modeOption?: 'replace' | 'append') => void;
}

export const AiAssistModal: React.FC<AiAssistModalProps> = ({
  projectId,
  title,
  existingDescription = '',
  mode = 'GENERATE',
  isOpen,
  onClose,
  onApply,
}) => {
  const [type, setType] = useState<'TASK' | 'BUG'>('TASK');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiAssistResponse | null>(null);

  // Editable preview states
  const [previewDescription, setPreviewDescription] = useState('');
  const [selectedSubtasks, setSelectedSubtasks] = useState<{ title: string; selected: boolean }[]>([]);
  const [suggestedPriority, setSuggestedPriority] = useState<TaskPriority>('MEDIUM');

  // Replace vs Append prompt dialog state
  const [showReplacePrompt, setShowReplacePrompt] = useState(false);

  const fetchAiAssist = async (customType = type) => {
    setLoading(true);
    setError(null);
    setShowReplacePrompt(false);

    try {
      const data = await apiFetch<AiAssistResponse>(`/projects/${projectId}/ai/task-assist`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          type: customType,
          existing_description: existingDescription,
          mode,
        }),
      });

      setResult(data);
      setPreviewDescription(data.description || '');
      setSelectedSubtasks((data.subtasks || []).map((s) => ({ title: s, selected: true })));
      setSuggestedPriority(data.suggested_priority || 'MEDIUM');
    } catch (err: any) {
      setError(err.message || 'AI request failed');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && title.trim().length >= 3) {
      fetchAiAssist();
    } else if (!isOpen) {
      setResult(null);
      setError(null);
      setShowReplacePrompt(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyClick = () => {
    if (mode !== 'SUBTASKS_ONLY' && existingDescription.trim().length > 0) {
      setShowReplacePrompt(true);
      return;
    }
    doApply('replace');
  };

  const doApply = (option: 'replace' | 'append') => {
    const activeSubtasks = selectedSubtasks.filter((s) => s.selected).map((s) => s.title.trim());
    onApply(
      {
        description: previewDescription,
        subtasks: activeSubtasks,
        priority: suggestedPriority,
      },
      option
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-app-border rounded-2xl shadow-soft-lg w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-app-border flex items-center justify-between bg-primary-soft/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-app-text font-heading">
                AI Task Assistant
              </h3>
              <p className="text-[11px] text-app-text-muted">
                {mode === 'SUBTASKS_ONLY' ? 'Generating subtasks' : 'Drafting task description & checklist'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-app-text-muted hover:text-app-text rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Segmented Type Toggle */}
          <div className="flex items-center justify-between gap-4 bg-surface-soft p-1.5 rounded-xl border border-app-border/60">
            <span className="text-xs font-semibold text-app-text px-2">Task Type:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setType('TASK');
                  fetchAiAssist('TASK');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  type === 'TASK'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-app-text-muted hover:text-app-text hover:bg-surface'
                }`}
              >
                Feature Task
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('BUG');
                  fetchAiAssist('BUG');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  type === 'BUG'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-app-text-muted hover:text-app-text hover:bg-surface'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                <span>Bug Report</span>
              </button>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3 text-app-text-muted">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-xs font-semibold animate-pulse">Thinking & drafting structured task details...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-4 rounded-xl text-xs space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchAiAssist()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#B4413C] text-white rounded-lg font-semibold hover:bg-[#B4413C]/90 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Request</span>
              </button>
            </div>
          )}

          {/* Replace vs Append Dialog Prompt */}
          {showReplacePrompt && (
            <div className="bg-[#FFF1D6] border border-[#A8680F]/30 p-4 rounded-xl space-y-3 text-xs text-[#A8680F] animate-in fade-in">
              <p className="font-bold">Replace or append to existing description?</p>
              <p>Your task description already contains text. Choose how to merge the AI suggestion:</p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => doApply('replace')}
                  className="px-3 py-1.5 bg-[#A8680F] text-white rounded-lg font-bold hover:bg-[#A8680F]/90 transition-colors"
                >
                  Replace Existing
                </button>
                <button
                  type="button"
                  onClick={() => doApply('append')}
                  className="px-3 py-1.5 bg-surface text-[#A8680F] border border-[#A8680F]/40 rounded-lg font-bold hover:bg-surface-soft transition-colors"
                >
                  Append Below
                </button>
                <button
                  type="button"
                  onClick={() => setShowReplacePrompt(false)}
                  className="px-3 py-1.5 text-app-text-muted hover:text-app-text"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* AI Result Preview Panel */}
          {result && !loading && !error && (
            <div className="space-y-4">
              {/* Description Preview */}
              {mode !== 'SUBTASKS_ONLY' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-app-text">Suggested Description</label>
                  <textarea
                    rows={6}
                    value={previewDescription}
                    onChange={(e) => setPreviewDescription(e.target.value)}
                    className="w-full p-3 bg-surface-soft border border-app-border rounded-xl text-xs text-app-text focus:outline-none focus:ring-1 focus:ring-primary font-mono leading-relaxed"
                  />
                </div>
              )}

              {/* Subtasks Preview */}
              {selectedSubtasks.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-app-text">Suggested Subtasks ({selectedSubtasks.filter(s => s.selected).length}/{selectedSubtasks.length})</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedSubtasks.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-surface-soft/60 p-2 rounded-lg text-xs">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const updated = [...selectedSubtasks];
                            updated[idx].selected = e.target.checked;
                            setSelectedSubtasks(updated);
                          }}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const updated = [...selectedSubtasks];
                            updated[idx].title = e.target.value;
                            setSelectedSubtasks(updated);
                          }}
                          className="flex-1 bg-transparent text-xs text-app-text focus:outline-none border-b border-transparent focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Priority */}
              <div className="flex items-center justify-between bg-surface-soft p-3 rounded-xl border border-app-border/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-app-text">Suggested Priority:</span>
                  <PriorityBadge priority={suggestedPriority} size="sm" />
                </div>
              </div>

              {/* AI Hint Line */}
              <p className="text-[11px] text-app-text-muted italic text-center">
                ✨ AI-generated content. Please review and edit before applying.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-app-border bg-surface-soft/40 flex items-center justify-between">
          <button
            type="button"
            onClick={() => fetchAiAssist()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-app-border hover:border-primary text-app-text-muted hover:text-primary rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-app-border hover:bg-surface text-app-text-muted hover:text-app-text rounded-xl text-xs font-semibold transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={loading || !result}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Use This</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
