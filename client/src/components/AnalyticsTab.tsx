'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, apiDownloadBlob } from '@/lib/api';
import { AnalyticsData, AnalyticsRange } from '@/lib/types';
import { Avatar } from './Avatar';
import {
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Sparkles,
  Table as TableIcon,
  PieChart as PieChartIcon,
  CheckCircle2,
  Clock,
  ListTodo,
  Activity,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface AnalyticsTabProps {
  projectId: number;
  realtimeRefreshKey?: number;
}

// Design Token Colors
const COLORS = {
  todo: '#7FB2D9',
  inProgress: '#F2B84B',
  done: '#5DB67A',
  primary: '#3FA796',
  accent: '#F4B393',
  muted: '#7A746B',
  border: '#E8E2D9',
  surfaceSoft: '#F4EFE7',
  priority: {
    LOW: { total: '#BCE5C7', done: '#2E7D4F' },
    MEDIUM: { total: '#FDE9C4', done: '#A8680F' },
    HIGH: { total: '#FBDAD8', done: '#B4413C' },
  },
};

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ projectId, realtimeRefreshKey = 0 }) => {
  const [range, setRange] = useState<AnalyticsRange>('14');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Table view toggles for accessible data fallback
  const [showTableMap, setShowTableMap] = useState<Record<string, boolean>>({});

  const toggleTableView = (chartId: string) => {
    setShowTableMap(prev => ({ ...prev, [chartId]: !prev[chartId] }));
  };

  const fetchAnalytics = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefetching(true);
    }
    setError(null);

    try {
      const res = await apiFetch<AnalyticsData>(`/projects/${projectId}/analytics?range=${range}`);
      setData(res);
      const now = new Date();
      setLastUpdated(now.toISOString().substring(11, 19) + ' UTC');
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(data === null);
  }, [projectId, range]);

  useEffect(() => {
    if (realtimeRefreshKey > 0 && !isLoading) {
      fetchAnalytics(false);
    }
  }, [realtimeRefreshKey]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const blob = await apiDownloadBlob(`/projects/${projectId}/analytics/export.csv`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-tasks.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to download CSV export');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="h-12 bg-surface-soft rounded-xl w-full" />
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-surface rounded-xl border border-app-border p-4 shadow-soft" />
          ))}
        </div>
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-72 bg-surface rounded-xl border border-app-border p-4 shadow-soft" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-[#FBDAD8]/50 border border-[#B4413C]/30 text-[#B4413C] p-6 rounded-xl text-xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Analytics Error</span>
        </div>
        <p>{error}</p>
        <button
          onClick={() => fetchAnalytics(true)}
          className="px-4 py-2 bg-[#B4413C] text-white rounded-lg font-semibold hover:bg-[#B4413C]/90 transition-colors"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  if (!data || data.summary.total === 0) {
    return (
      <div className="bg-surface rounded-xl border border-app-border p-12 shadow-soft text-center space-y-4 max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto">
          <Activity className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-app-text font-heading">No Activity Yet</h3>
        <p className="text-xs text-app-text-muted leading-relaxed">
          Move some tasks on the board to generate productivity metrics, cycle time analysis, and burndown analytics.
        </p>
        <button
          onClick={() => fetchAnalytics(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-hover transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Data</span>
        </button>
      </div>
    );
  }

  const { summary, status_distribution, priority_distribution, workload, throughput, burndown, top_contributors, insights } = data;

  // Format cycle time
  const formatCycleTime = (hours: number) => {
    if (!hours || hours === 0) return '0.0 hrs';
    if (hours >= 24) {
      return `${(hours / 24).toFixed(1)} days`;
    }
    return `${hours.toFixed(1)} hrs`;
  };

  // Completed trend calculation
  const completedDelta = summary.completed_in_range - summary.completed_in_previous_range;
  const isTrendUp = completedDelta > 0;
  const isTrendDown = completedDelta < 0;

  return (
    <div className="space-y-6 relative">
      {/* Subtle Refetch Overlay Indicator */}
      {isRefetching && (
        <div className="absolute top-2 right-2 bg-primary-soft text-primary text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 z-10 shadow-xs border border-primary/20">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Updating...</span>
        </div>
      )}

      {/* Header Controls Row */}
      <div className="bg-surface rounded-xl border border-app-border p-4 shadow-soft flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-lg font-bold text-app-text font-heading flex items-center gap-2">
            <span>Sprint analytics</span>
            {lastUpdated && (
              <span className="text-[11px] font-normal text-app-text-muted">
                (Updated {lastUpdated})
              </span>
            )}
          </h2>
          <p className="text-xs text-app-text-muted">Productivity trends and team performance metrics</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Segmented Range Control */}
          <div className="inline-flex p-1 bg-surface-soft border border-app-border rounded-lg text-xs font-semibold">
            {(['7', '14', '30', 'all'] as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  range === r
                    ? 'bg-surface text-primary shadow-xs'
                    : 'text-app-text-muted hover:text-app-text'
                }`}
              >
                {r === 'all' ? 'All' : `${r}d`}
              </button>
            ))}
          </div>

          {/* Download CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-soft hover:bg-surface-soft/80 border border-app-border text-app-text font-semibold text-xs rounded-lg transition-colors disabled:opacity-50"
            title="Export tasks report to CSV file"
          >
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Insights Banner */}
      {insights && insights.length > 0 && (
        <div className="bg-primary-soft/60 border border-primary/20 rounded-xl p-4 shadow-soft space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary font-heading">
            <Sparkles className="w-4 h-4" />
            <span>Productivity Insights</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-app-text">
            {insights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-surface/80 p-2.5 rounded-lg border border-primary/10">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className={`grid grid-cols-2 md:grid-cols-4 ${summary.overdue_count && summary.overdue_count > 0 ? 'lg:grid-cols-5' : ''} gap-4`}>
        {/* Total Tasks */}
        <div className="bg-surface rounded-xl border border-app-border p-4 shadow-soft space-y-1.5">
          <div className="flex items-center justify-between text-app-text-muted">
            <span className="text-xs font-semibold">Total Tasks</span>
            <ListTodo className="w-4 h-4 text-app-text-muted/60" />
          </div>
          <div className="text-2xl font-bold text-app-text font-heading">{summary.total}</div>
          <p className="text-[11px] text-app-text-muted truncate">Active in project workspace</p>
        </div>

        {/* Completed */}
        <div className="bg-surface rounded-xl border border-app-border p-4 shadow-soft space-y-1.5">
          <div className="flex items-center justify-between text-app-text-muted">
            <span className="text-xs font-semibold">Completed</span>
            <CheckCircle2 className="w-4 h-4 text-[#5DB67A]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-app-text font-heading">{summary.done}</span>
            <span className="text-xs font-semibold text-[#5DB67A]">({summary.completion_rate}%)</span>
          </div>
          <div className="w-full h-1.5 bg-surface-soft rounded-full overflow-hidden border border-app-border/40 mt-1">
            <div
              className="h-full bg-[#5DB67A] transition-all duration-300"
              style={{ width: `${summary.completion_rate}%` }}
            />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-surface rounded-xl border border-app-border p-4 shadow-soft space-y-1.5">
          <div className="flex items-center justify-between text-app-text-muted">
            <span className="text-xs font-semibold">In Progress</span>
            <Activity className="w-4 h-4 text-[#F2B84B]" />
          </div>
          <div className="text-2xl font-bold text-app-text font-heading">{summary.in_progress}</div>
          <p className="text-[11px] text-app-text-muted truncate">{summary.todo} tasks in To Do</p>
        </div>

        {/* Overdue Card */}
        {summary.overdue_count !== undefined && summary.overdue_count > 0 && (
          <div className="bg-[#FBDAD8]/40 rounded-xl border border-[#B4413C]/30 p-4 shadow-soft space-y-1.5">
            <div className="flex items-center justify-between text-[#B4413C]">
              <span className="text-xs font-semibold">Overdue Tasks</span>
              <AlertCircle className="w-4 h-4 text-[#B4413C]" />
            </div>
            <div className="text-2xl font-bold text-[#B4413C] font-heading">{summary.overdue_count}</div>
            <p className="text-[11px] text-[#B4413C]/80 truncate">Tasks requiring urgent attention</p>
          </div>
        )}

        {/* Avg Cycle Time & Trend */}
        <div className="bg-surface rounded-xl border border-app-border p-4 shadow-soft space-y-1.5">
          <div className="flex items-center justify-between text-app-text-muted">
            <span className="text-xs font-semibold">Avg Cycle Time</span>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-app-text font-heading">
            {formatCycleTime(summary.avg_cycle_time_hours)}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            {range !== 'all' && (
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] ${
                  isTrendUp
                    ? 'bg-[#D9F0DF] text-[#2E7D4F]'
                    : isTrendDown
                    ? 'bg-[#FDE9C4] text-[#A8680F]'
                    : 'bg-surface-soft text-app-text-muted'
                }`}
                title={`Completed in selected ${range}d: ${summary.completed_in_range} (vs ${summary.completed_in_previous_range} in prior period)`}
              >
                {isTrendUp ? (
                  <TrendingUp className="w-3 h-3" />
                ) : isTrendDown ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Minus className="w-3 h-3" />
                )}
                <span>
                  {isTrendUp ? `+${completedDelta}` : completedDelta} tasks vs prior
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid (2 Columns on Desktop, 1 on Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Status Distribution (Donut Chart) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-app-text font-heading">Status Distribution</h3>
              <p className="text-[11px] text-app-text-muted">Breakdown of tasks by active status column</p>
            </div>
            <button
              onClick={() => toggleTableView('status')}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg border border-app-border bg-surface-soft transition-colors"
              title="Toggle accessible table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {showTableMap['status'] ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left text-app-text border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-app-text-muted">
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Count</th>
                    <th className="py-2 px-3">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {status_distribution.map(item => (
                    <tr key={item.status} className="border-b border-app-border/40">
                      <td className="py-2 px-3 font-semibold">{item.status}</td>
                      <td className="py-2 px-3">{item.count}</td>
                      <td className="py-2 px-3">
                        {summary.total > 0 ? Math.round((item.count / summary.total) * 100) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full" aria-label="Status Distribution Donut Chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={status_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                  >
                    {status_distribution.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={
                          entry.status === 'TODO'
                            ? COLORS.todo
                            : entry.status === 'IN_PROGRESS'
                            ? COLORS.inProgress
                            : COLORS.done
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: COLORS.border, borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    formatter={(val) => <span className="text-xs text-app-text font-medium">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Burndown Chart (Line Chart) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-app-text font-heading">Burndown Trend</h3>
              <p className="text-[11px] text-app-text-muted">Remaining open workload vs ideal trajectory</p>
            </div>
            <button
              onClick={() => toggleTableView('burndown')}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg border border-app-border bg-surface-soft transition-colors"
              title="Toggle accessible table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {showTableMap['burndown'] ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left text-app-text border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-app-text-muted">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Remaining</th>
                    <th className="py-2 px-3">Ideal</th>
                  </tr>
                </thead>
                <tbody>
                  {burndown.map(item => (
                    <tr key={item.date} className="border-b border-app-border/40">
                      <td className="py-2 px-3 font-semibold">{item.date}</td>
                      <td className="py-2 px-3">{item.remaining}</td>
                      <td className="py-2 px-3">{item.ideal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full" aria-label="Burndown Line Chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burndown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: COLORS.border, borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" formatter={(val) => <span className="text-xs text-app-text font-medium">{val}</span>} />
                  <Line type="monotone" dataKey="remaining" name="Remaining" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="ideal" name="Ideal" stroke={COLORS.muted} strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Throughput (Bar Chart) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-app-text font-heading">Daily Throughput</h3>
              <p className="text-[11px] text-app-text-muted">Tasks completed per day in selected range</p>
            </div>
            <button
              onClick={() => toggleTableView('throughput')}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg border border-app-border bg-surface-soft transition-colors"
              title="Toggle accessible table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {showTableMap['throughput'] ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left text-app-text border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-app-text-muted">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Completed Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {throughput.map(item => (
                    <tr key={item.date} className="border-b border-app-border/40">
                      <td className="py-2 px-3 font-semibold">{item.date}</td>
                      <td className="py-2 px-3">{item.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full" aria-label="Daily Throughput Bar Chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={throughput} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.muted }} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: COLORS.border, borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="completed" name="Completed Tasks" fill={COLORS.done} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 4. Workload by Member (Horizontal Stacked Bar Chart) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-app-text font-heading">Workload by Member</h3>
              <p className="text-[11px] text-app-text-muted">Task status distribution per team member</p>
            </div>
            <button
              onClick={() => toggleTableView('workload')}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg border border-app-border bg-surface-soft transition-colors"
              title="Toggle accessible table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {showTableMap['workload'] ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left text-app-text border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-app-text-muted">
                    <th className="py-2 px-3">Member</th>
                    <th className="py-2 px-3">To Do</th>
                    <th className="py-2 px-3">In Progress</th>
                    <th className="py-2 px-3">Done</th>
                    <th className="py-2 px-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.map(item => (
                    <tr key={item.name} className="border-b border-app-border/40">
                      <td className="py-2 px-3 font-semibold">{item.name}</td>
                      <td className="py-2 px-3">{item.todo}</td>
                      <td className="py-2 px-3">{item.in_progress}</td>
                      <td className="py-2 px-3">{item.done}</td>
                      <td className="py-2 px-3 font-bold">{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full" aria-label="Workload by Member Stacked Bar Chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={workload} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: COLORS.muted }} width={90} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: COLORS.border, borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" formatter={(val) => <span className="text-xs text-app-text font-medium">{val}</span>} />
                  <Bar dataKey="todo" name="To Do" stackId="a" fill={COLORS.todo} />
                  <Bar dataKey="in_progress" name="In Progress" stackId="a" fill={COLORS.inProgress} />
                  <Bar dataKey="done" name="Done" stackId="a" fill={COLORS.done} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 5. Priority Breakdown (Grouped Bar Chart) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-app-text font-heading">Priority Breakdown</h3>
              <p className="text-[11px] text-app-text-muted">Total vs Completed tasks by priority level</p>
            </div>
            <button
              onClick={() => toggleTableView('priority')}
              className="p-1.5 text-app-text-muted hover:text-primary rounded-lg border border-app-border bg-surface-soft transition-colors"
              title="Toggle accessible table view"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {showTableMap['priority'] ? (
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-left text-app-text border-collapse">
                <thead>
                  <tr className="border-b border-app-border text-app-text-muted">
                    <th className="py-2 px-3">Priority</th>
                    <th className="py-2 px-3">Total Tasks</th>
                    <th className="py-2 px-3">Completed Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {priority_distribution.map(item => (
                    <tr key={item.priority} className="border-b border-app-border/40">
                      <td className="py-2 px-3 font-semibold">{item.priority}</td>
                      <td className="py-2 px-3">{item.count}</td>
                      <td className="py-2 px-3">{item.done}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 w-full" aria-label="Priority Breakdown Grouped Bar Chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priority_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                  <XAxis dataKey="priority" tick={{ fontSize: 11, fill: COLORS.muted }} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.muted }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#FFFFFF', borderColor: COLORS.border, borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" formatter={(val) => <span className="text-xs text-app-text font-medium">{val}</span>} />
                  <Bar dataKey="count" name="Total Tasks" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="done" name="Completed Tasks" fill={COLORS.done} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 6. Top Contributors (Ranked List with Thin Progress Bar) */}
        <div className="bg-surface rounded-xl border border-app-border p-5 shadow-soft space-y-4 flex flex-col justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-bold text-app-text font-heading flex items-center gap-1.5">
              <Award className="w-4 h-4 text-primary" />
              <span>Top Contributors</span>
            </h3>
            <p className="text-[11px] text-app-text-muted">Most completed tasks in selected period</p>
          </div>

          {top_contributors.length === 0 ? (
            <p className="text-xs text-app-text-muted py-8 text-center">No completed tasks recorded in this period.</p>
          ) : (
            <div className="space-y-3 py-1">
              {top_contributors.map((c, index) => {
                const maxCompleted = top_contributors[0]?.completed || 1;
                const percent = Math.round((c.completed / maxCompleted) * 100);

                return (
                  <div key={c.user_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-app-text-muted w-4">#{index + 1}</span>
                        <Avatar name={c.name} size="sm" />
                        <span className="font-semibold text-app-text">{c.name}</span>
                      </div>
                      <span className="font-bold text-primary">{c.completed} completed</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-soft rounded-full overflow-hidden border border-app-border/40">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-2 border-t border-app-border/60 text-[11px] text-app-text-muted flex justify-between">
            <span>Range: {range === 'all' ? 'All time' : `Last ${range} days`}</span>
            <span>Total Completed: {summary.completed_in_range}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
