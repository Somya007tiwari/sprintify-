'use client';

import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ProjectMember, TaskPriority, BoardFilterState, DueFilterOption, User } from '@/lib/types';
import { PriorityBadge } from './PriorityBadge';
import { Avatar } from './Avatar';
import {
  Search,
  X,
  Filter,
  UserCheck,
  Calendar,
  SlidersHorizontal,
  Info,
  Check,
  ChevronDown,
} from 'lucide-react';

interface BoardFilterToolbarProps {
  members: ProjectMember[];
  currentUser: User | null;
  onFilterChange: (filters: BoardFilterState) => void;
  isFiltered: boolean;
  onClearFilters: () => void;
}

export interface BoardFilterToolbarRef {
  focusSearch: () => void;
  clearSearch: () => void;
}

export const BoardFilterToolbar = forwardRef<BoardFilterToolbarRef, BoardFilterToolbarProps>(
  ({ members, currentUser, onFilterChange, isFiltered, onClearFilters }, ref) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Search Input state
    const [searchInput, setSearchInput] = useState<string>('');
    const [debouncedSearch, setDebouncedSearch] = useState<string>('');

    // Filter selections
    const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
    const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
    const [selectedDue, setSelectedDue] = useState<DueFilterOption>('all');
    const [myTasksOnly, setMyTasksOnly] = useState<boolean>(false);

    // Dropdown open states
    const [openDropdown, setOpenDropdown] = useState<'priority' | 'assignee' | 'due' | null>(null);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Expose focus/clear search methods to parent
    useImperativeHandle(ref, () => ({
      focusSearch: () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      },
      clearSearch: () => {
        setSearchInput('');
        setDebouncedSearch('');
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
      },
    }));

    // Read initial state from URL query params on mount or URL change
    useEffect(() => {
      const q = searchParams.get('q') || '';
      const priorityParam = searchParams.get('priority');
      const assigneeParam = searchParams.get('assignee');
      const dueParam = (searchParams.get('due') as DueFilterOption) || 'all';

      setSearchInput(q);
      setDebouncedSearch(q);

      if (priorityParam) {
        const pArr = priorityParam.split(',').filter((p) => ['LOW', 'MEDIUM', 'HIGH'].includes(p)) as TaskPriority[];
        setSelectedPriorities(pArr);
      } else {
        setSelectedPriorities([]);
      }

      if (assigneeParam) {
        const aArr = assigneeParam.split(',');
        setSelectedAssignees(aArr);
      } else {
        setSelectedAssignees([]);
      }

      if (['overdue', 'today', 'next7', 'nodue'].includes(dueParam)) {
        setSelectedDue(dueParam);
      } else {
        setSelectedDue('all');
      }

      if (currentUser && assigneeParam && assigneeParam.split(',').includes(String(currentUser.id))) {
        setMyTasksOnly(true);
      } else {
        setMyTasksOnly(false);
      }
    }, [searchParams, currentUser?.id]);

    // 200ms debounce for search text
    useEffect(() => {
      const timer = setTimeout(() => {
        setDebouncedSearch(searchInput);
      }, 200);
      return () => clearTimeout(timer);
    }, [searchInput]);

    // Propagate state to parent whenever filter values change
    useEffect(() => {
      const state: BoardFilterState = {
        searchQuery: debouncedSearch.trim(),
        priorities: selectedPriorities,
        assignees: selectedAssignees,
        due: selectedDue,
        myTasksOnly,
      };
      onFilterChange(state);
      updateUrl(state);
    }, [debouncedSearch, selectedPriorities, selectedAssignees, selectedDue, myTasksOnly]);

    // Click outside listener for dropdown popovers
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpenDropdown(null);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync filter state to URL query params safely preserving ?tab= and ?task=
    const updateUrl = (filters: BoardFilterState) => {
      const params = new URLSearchParams(searchParams.toString());

      if (filters.searchQuery) {
        params.set('q', filters.searchQuery);
      } else {
        params.delete('q');
      }

      if (filters.priorities.length > 0) {
        params.set('priority', filters.priorities.join(','));
      } else {
        params.delete('priority');
      }

      if (filters.assignees.length > 0) {
        params.set('assignee', filters.assignees.join(','));
      } else {
        params.delete('assignee');
      }

      if (filters.due && filters.due !== 'all') {
        params.set('due', filters.due);
      } else {
        params.delete('due');
      }

      const newQueryStr = params.toString();
      const currentQueryStr = searchParams.toString();

      if (newQueryStr !== currentQueryStr) {
        router.replace(`${pathname}${newQueryStr ? `?${newQueryStr}` : ''}`, { scroll: false });
      }
    };

    const togglePriority = (p: TaskPriority) => {
      setSelectedPriorities((prev) =>
        prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
      );
    };

    const toggleAssignee = (idStr: string) => {
      setSelectedAssignees((prev) =>
        prev.includes(idStr) ? prev.filter((item) => item !== idStr) : [...prev, idStr]
      );
    };

    const handleToggleMyTasks = () => {
      if (!currentUser) return;
      const myIdStr = String(currentUser.id);
      if (myTasksOnly) {
        setMyTasksOnly(false);
        setSelectedAssignees((prev) => prev.filter((id) => id !== myIdStr));
      } else {
        setMyTasksOnly(true);
        setSelectedAssignees((prev) => (prev.includes(myIdStr) ? prev : [...prev, myIdStr]));
      }
    };

    const handleClearAll = () => {
      setSearchInput('');
      setDebouncedSearch('');
      setSelectedPriorities([]);
      setSelectedAssignees([]);
      setSelectedDue('all');
      setMyTasksOnly(false);
      onClearFilters();
    };

    const getDueLabel = (option: DueFilterOption) => {
      switch (option) {
        case 'overdue':
          return 'Overdue';
        case 'today':
          return 'Due today';
        case 'next7':
          return 'Next 7 days';
        case 'nodue':
          return 'No due date';
        default:
          return 'All due dates';
      }
    };

    return (
      <div ref={containerRef} className="space-y-2 mb-4 sticky top-16 z-20 bg-app-bg/95 backdrop-blur-xs py-2 border-b border-app-border/40">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-app-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tasks... (Press '/' to focus)"
              className="w-full pl-9 pr-8 py-1.5 bg-surface border border-app-border rounded-xl text-xs text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-app-text-muted hover:text-app-text rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority Multi-Select Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-xs ${
                  selectedPriorities.length > 0
                    ? 'bg-primary-soft border-primary/40 text-primary'
                    : 'bg-surface border-app-border text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Priority</span>
                {selectedPriorities.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold ml-0.5">
                    {selectedPriorities.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {openDropdown === 'priority' && (
                <div className="absolute left-0 mt-1.5 w-44 bg-surface rounded-xl border border-app-border shadow-soft-lg z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                  {(['HIGH', 'MEDIUM', 'LOW'] as TaskPriority[]).map((p) => {
                    const isChecked = selectedPriorities.includes(p);
                    return (
                      <div
                        key={p}
                        onClick={() => togglePriority(p)}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-soft cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-primary border-primary text-white' : 'border-app-border bg-surface'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <PriorityBadge priority={p} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assignee Multi-Select Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-xs ${
                  selectedAssignees.length > 0
                    ? 'bg-primary-soft border-primary/40 text-primary'
                    : 'bg-surface border-app-border text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Assignee</span>
                {selectedAssignees.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center font-bold ml-0.5">
                    {selectedAssignees.length}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {openDropdown === 'assignee' && (
                <div className="absolute left-0 mt-1.5 w-52 bg-surface rounded-xl border border-app-border shadow-soft-lg z-30 p-2 space-y-1 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  {/* Unassigned option */}
                  <div
                    onClick={() => toggleAssignee('none')}
                    className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-soft cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          selectedAssignees.includes('none') ? 'bg-primary border-primary text-white' : 'border-app-border bg-surface'
                        }`}
                      >
                        {selectedAssignees.includes('none') && <Check className="w-3 h-3" />}
                      </div>
                      <span className="text-app-text-muted font-medium">Unassigned</span>
                    </div>
                  </div>

                  {members.map((m) => {
                    const isChecked = selectedAssignees.includes(String(m.id));
                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleAssignee(String(m.id))}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-soft cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              isChecked ? 'bg-primary border-primary text-white' : 'border-app-border bg-surface'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <Avatar name={m.name} size="sm" />
                          <span className="truncate text-app-text font-medium">{m.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Due Date Single-Select Dropdown */}
            <div className="relative">
              <button
                onClick={() => setOpenDropdown(openDropdown === 'due' ? null : 'due')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-xs ${
                  selectedDue !== 'all'
                    ? 'bg-primary-soft border-primary/40 text-primary'
                    : 'bg-surface border-app-border text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{selectedDue !== 'all' ? getDueLabel(selectedDue) : 'Due date'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {openDropdown === 'due' && (
                <div className="absolute left-0 mt-1.5 w-48 bg-surface rounded-xl border border-app-border shadow-soft-lg z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100 text-xs">
                  {(['all', 'overdue', 'today', 'next7', 'nodue'] as DueFilterOption[]).map((option) => (
                    <div
                      key={option}
                      onClick={() => {
                        setSelectedDue(option);
                        setOpenDropdown(null);
                      }}
                      className={`p-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                        selectedDue === option ? 'bg-primary-soft text-primary font-semibold' : 'hover:bg-surface-soft text-app-text'
                      }`}
                    >
                      <span>{getDueLabel(option)}</span>
                      {selectedDue === option && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Tasks Quick Toggle */}
            {currentUser && (
              <button
                onClick={handleToggleMyTasks}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors shadow-xs ${
                  myTasksOnly
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface border-app-border text-app-text-muted hover:text-app-text hover:bg-surface-soft'
                }`}
                title="Filter tasks assigned to me"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>My Tasks</span>
              </button>
            )}

            {/* Clear All Button */}
            {isFiltered && (
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1.5 text-xs font-semibold text-app-text-muted hover:text-feedback-error transition-colors underline decoration-dotted"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {isFiltered && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-app-text-muted uppercase tracking-wider">Active Filters:</span>

            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-soft border border-app-border text-[11px] font-medium text-app-text">
                <span>Search: "{debouncedSearch}"</span>
                <button onClick={() => setSearchInput('')} className="hover:text-feedback-error">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedPriorities.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-soft border border-app-border text-[11px] font-medium text-app-text">
                <PriorityBadge priority={p} size="sm" />
                <button onClick={() => togglePriority(p)} className="hover:text-feedback-error">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {selectedAssignees.map((idStr) => {
              const name = idStr === 'none' ? 'Unassigned' : members.find((m) => String(m.id) === idStr)?.name || `User #${idStr}`;
              return (
                <span key={idStr} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-soft border border-app-border text-[11px] font-medium text-app-text">
                  <span>Assignee: {name}</span>
                  <button onClick={() => toggleAssignee(idStr)} className="hover:text-feedback-error">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            {selectedDue !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-soft border border-app-border text-[11px] font-medium text-app-text">
                <span>Due: {getDueLabel(selectedDue)}</span>
                <button onClick={() => setSelectedDue('all')} className="hover:text-feedback-error">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Drag-and-Drop Paused Info Banner */}
        {isFiltered && (
          <div className="bg-[#FDF3E3]/80 border border-[#A8680F]/30 text-[#A8680F] px-3 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-[#A8680F]" />
              <span className="font-medium">Filters are on, drag and drop is paused. Clear filters to move cards.</span>
            </div>
            <button
              onClick={handleClearAll}
              className="font-bold underline hover:text-[#804E09] text-[11px] shrink-0"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    );
  }
);

BoardFilterToolbar.displayName = 'BoardFilterToolbar';
