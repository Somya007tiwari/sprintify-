const pool = require('../config/db');
const { z } = require('zod');

const analyticsQuerySchema = z.object({
  range: z.enum(['7', '14', '30', 'all']).optional().default('14'),
});

/**
 * Helper to escape fields for CSV output according to RFC-4180
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * GET /api/projects/:id/analytics?range=7|14|30|all
 */
const getProjectAnalytics = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this project' });
    }

    const parseResult = analyticsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid range parameter. Allowed values: 7, 14, 30, all' });
    }

    const range = parseResult.data.range;
    const now = new Date();

    // 1. Fetch Summary & Distribution Queries in parallel
    const [tasksRes, membersRes, logsRes] = await Promise.all([
      pool.query(
        `SELECT 
           t.id, t.title, t.status, t.priority, t.assignee_id, t.due_date::text AS due_date, t.created_at, t.updated_at,
           u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON t.assignee_id = u.id
         WHERE t.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT pm.user_id, u.name
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1`,
        [projectId]
      ),
      pool.query(
        `SELECT al.task_id, al.action, al.from_status, al.to_status, al.created_at
         FROM activity_logs al
         JOIN tasks t ON al.task_id = t.id
         WHERE t.project_id = $1 AND al.action IN ('CREATED', 'MOVED')
         ORDER BY al.created_at ASC`,
        [projectId]
      )
    ]);

    const tasks = tasksRes.rows;
    const members = membersRes.rows;
    const logs = logsRes.rows;

    const totalTasks = tasks.length;
    const todoTasks = tasks.filter(t => t.status === 'TODO').length;
    const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneTasks = tasks.filter(t => t.status === 'DONE').length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 1000) / 10 : 0;
    
    const todayStr = now.toISOString().substring(0, 10);
    const overdueCount = tasks.filter(t => t.status !== 'DONE' && t.due_date && t.due_date < todayStr).length;

    // Determine completion history & cycle/lead times per task
    // Task completion timestamp = latest log where action='MOVED' and to_status='DONE' (or task updated_at if status=DONE)
    const taskCompletionMap = new Map();
    const taskStartMap = new Map();

    for (const log of logs) {
      if (log.action === 'CREATED' && log.to_status === 'IN_PROGRESS') {
        if (!taskStartMap.has(log.task_id)) {
          taskStartMap.set(log.task_id, new Date(log.created_at));
        }
      } else if (log.action === 'MOVED') {
        if (log.to_status === 'IN_PROGRESS' && !taskStartMap.has(log.task_id)) {
          taskStartMap.set(log.task_id, new Date(log.created_at));
        }
        if (log.to_status === 'DONE') {
          taskCompletionMap.set(log.task_id, new Date(log.created_at));
        }
      }
    }

    // Fallback for done tasks that may not have explicit MOVED log
    for (const t of tasks) {
      if (t.status === 'DONE' && !taskCompletionMap.has(t.id)) {
        taskCompletionMap.set(t.id, new Date(t.updated_at));
      }
    }

    // Cycle time & lead time calculations for currently DONE tasks
    let cycleTimeSumHours = 0;
    let leadTimeSumHours = 0;
    let completedDoneCount = 0;

    for (const t of tasks) {
      if (t.status === 'DONE') {
        const completedAt = taskCompletionMap.get(t.id) || new Date(t.updated_at);
        const createdAt = new Date(t.created_at);
        const startedAt = taskStartMap.get(t.id) || createdAt;

        const cycleMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
        const leadMs = Math.max(0, completedAt.getTime() - createdAt.getTime());

        cycleTimeSumHours += cycleMs / (1000 * 3600);
        leadTimeSumHours += leadMs / (1000 * 3600);
        completedDoneCount++;
      }
    }

    const avgCycleTimeHours = completedDoneCount > 0 ? Math.round((cycleTimeSumHours / completedDoneCount) * 10) / 10 : 0;
    const avgLeadTimeHours = completedDoneCount > 0 ? Math.round((leadTimeSumHours / completedDoneCount) * 10) / 10 : 0;

    // Calculate Date Range Boundaries (in UTC)
    let rangeDays = 14;
    if (range === '7') rangeDays = 7;
    else if (range === '14') rangeDays = 14;
    else if (range === '30') rangeDays = 30;
    else if (range === 'all') {
      if (tasks.length > 0) {
        const earliestCreated = Math.min(...tasks.map(t => new Date(t.created_at).getTime()));
        const daysDiff = Math.ceil((now.getTime() - earliestCreated) / (24 * 3600 * 1000));
        rangeDays = Math.max(1, daysDiff);
      } else {
        rangeDays = 14;
      }
    }

    const rangeMs = rangeDays * 24 * 3600 * 1000;
    const currentRangeStart = new Date(now.getTime() - rangeMs);
    const previousRangeStart = new Date(now.getTime() - rangeMs * 2);

    // Completed in current vs previous range
    let completedInRange = 0;
    let completedInPrevRange = 0;

    for (const t of tasks) {
      const compAt = taskCompletionMap.get(t.id);
      if (compAt) {
        if (compAt >= currentRangeStart && compAt <= now) {
          completedInRange++;
        } else if (range !== 'all' && compAt >= previousRangeStart && compAt < currentRangeStart) {
          completedInPrevRange++;
        }
      }
    }

    // Status Distribution
    const statusDistribution = [
      { status: 'TODO', count: todoTasks },
      { status: 'IN_PROGRESS', count: inProgressTasks },
      { status: 'DONE', count: doneTasks },
    ];

    // Priority Distribution
    const priorityCounts = {
      LOW: { count: 0, done: 0 },
      MEDIUM: { count: 0, done: 0 },
      HIGH: { count: 0, done: 0 },
    };
    for (const t of tasks) {
      if (priorityCounts[t.priority]) {
        priorityCounts[t.priority].count++;
        if (t.status === 'DONE') {
          priorityCounts[t.priority].done++;
        }
      }
    }
    const priorityDistribution = [
      { priority: 'LOW', count: priorityCounts.LOW.count, done: priorityCounts.LOW.done },
      { priority: 'MEDIUM', count: priorityCounts.MEDIUM.count, done: priorityCounts.MEDIUM.done },
      { priority: 'HIGH', count: priorityCounts.HIGH.count, done: priorityCounts.HIGH.done },
    ];

    // Workload by Member
    const memberWorkloadMap = new Map();
    // Initialize for all project members
    for (const m of members) {
      memberWorkloadMap.set(m.user_id, { user_id: m.user_id, name: m.name, todo: 0, in_progress: 0, done: 0, total: 0 });
    }
    // Unassigned tracker
    let unassignedWorkload = { user_id: null, name: 'Unassigned', todo: 0, in_progress: 0, done: 0, total: 0 };

    for (const t of tasks) {
      if (t.assignee_id === null) {
        unassignedWorkload.total++;
        if (t.status === 'TODO') unassignedWorkload.todo++;
        else if (t.status === 'IN_PROGRESS') unassignedWorkload.in_progress++;
        else if (t.status === 'DONE') unassignedWorkload.done++;
      } else {
        let memberData = memberWorkloadMap.get(t.assignee_id);
        if (!memberData) {
          memberData = { user_id: t.assignee_id, name: t.assignee_name || 'Member', todo: 0, in_progress: 0, done: 0, total: 0 };
          memberWorkloadMap.set(t.assignee_id, memberData);
        }
        memberData.total++;
        if (t.status === 'TODO') memberData.todo++;
        else if (t.status === 'IN_PROGRESS') memberData.in_progress++;
        else if (t.status === 'DONE') memberData.done++;
      }
    }

    const workload = Array.from(memberWorkloadMap.values());
    if (unassignedWorkload.total > 0) {
      workload.push(unassignedWorkload);
    }
    // Sort by open tasks (todo + in_progress) descending
    workload.sort((a, b) => (b.todo + b.in_progress) - (a.todo + a.in_progress));

    // Daily Throughput & Burndown Series
    // Generate dates list [day_0, day_1, ..., today]
    const dateList = [];
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(todayUtc.getTime() - i * 24 * 3600 * 1000);
      const isoStr = d.toISOString().substring(0, 10);
      dateList.push({ dateStr: isoStr, dateObj: d });
    }

    // Map throughput per day
    const throughputMap = new Map(dateList.map(d => [d.dateStr, 0]));
    for (const t of tasks) {
      const compAt = taskCompletionMap.get(t.id);
      if (compAt && compAt >= currentRangeStart) {
        const compDateStr = new Date(Date.UTC(compAt.getUTCFullYear(), compAt.getUTCMonth(), compAt.getUTCDate()))
          .toISOString()
          .substring(0, 10);
        if (throughputMap.has(compDateStr)) {
          throughputMap.set(compDateStr, throughputMap.get(compDateStr) + 1);
        }
      }
    }

    const throughput = dateList.map(d => ({
      date: d.dateStr,
      completed: throughputMap.get(d.dateStr) || 0
    }));

    // Calculate Burndown
    // For each date in dateList: remaining = tasks created on or before dayEnd that were NOT in DONE at dayEnd
    // Build logs per task index for fast lookup
    const taskLogsMap = new Map();
    for (const log of logs) {
      if (!taskLogsMap.has(log.task_id)) {
        taskLogsMap.set(log.task_id, []);
      }
      taskLogsMap.get(log.task_id).push(log);
    }

    const burndownRemainingList = [];

    for (const d of dateList) {
      // Day end timestamp: 23:59:59.999 UTC
      const dayEndMs = new Date(Date.UTC(d.dateObj.getUTCFullYear(), d.dateObj.getUTCMonth(), d.dateObj.getUTCDate(), 23, 59, 59, 999)).getTime();
      let openCountOnDay = 0;

      for (const t of tasks) {
        const taskCreatedMs = new Date(t.created_at).getTime();
        if (taskCreatedMs <= dayEndMs) {
          // Task existed at dayEnd. Determine its status at dayEnd
          const taskLogs = taskLogsMap.get(t.id) || [];
          let statusAtDayEnd = 'TODO';

          for (const l of taskLogs) {
            const logMs = new Date(l.created_at).getTime();
            if (logMs <= dayEndMs) {
              if (l.to_status) {
                statusAtDayEnd = l.to_status;
              }
            } else {
              break;
            }
          }

          if (statusAtDayEnd !== 'DONE') {
            openCountOnDay++;
          }
        }
      }

      burndownRemainingList.push(openCountOnDay);
    }

    const firstRemaining = burndownRemainingList.length > 0 ? burndownRemainingList[0] : 0;
    const numPoints = dateList.length;

    const burndown = dateList.map((d, i) => {
      const remaining = burndownRemainingList[i];
      let ideal = 0;
      if (numPoints > 1) {
        ideal = Math.max(0, Math.round((firstRemaining - i * (firstRemaining / (numPoints - 1))) * 10) / 10);
      }
      return {
        date: d.dateStr,
        remaining,
        ideal
      };
    });

    // Top Contributors (Top 5 assignees for tasks currently DONE completed in range)
    const contributorMap = new Map();
    for (const t of tasks) {
      if (t.status === 'DONE' && t.assignee_id !== null) {
        const compAt = taskCompletionMap.get(t.id);
        if (compAt && compAt >= currentRangeStart) {
          const currentCount = contributorMap.get(t.assignee_id) || { user_id: t.assignee_id, name: t.assignee_name || 'Member', completed: 0 };
          currentCount.completed++;
          contributorMap.set(t.assignee_id, currentCount);
        }
      }
    }

    const top_contributors = Array.from(contributorMap.values())
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);

    // Insights Generation (up to 4 deterministic strings)
    const insights = [];

    // Insight 1: Most open tasks
    const topWorkloadMember = workload.find(w => w.user_id !== null);
    if (topWorkloadMember && (topWorkloadMember.todo + topWorkloadMember.in_progress) > 0) {
      const openCount = topWorkloadMember.todo + topWorkloadMember.in_progress;
      insights.push(`${topWorkloadMember.name} has the most open tasks (${openCount}).`);
    }

    // Insight 2: Throughput comparison
    if (range !== 'all') {
      if (completedInPrevRange > 0) {
        const diffPct = Math.round(((completedInRange - completedInPrevRange) / completedInPrevRange) * 100);
        if (diffPct > 0) {
          insights.push(`Throughput is up ${diffPct}% compared to the previous ${rangeDays} days.`);
        } else if (diffPct < 0) {
          insights.push(`Throughput is down ${Math.abs(diffPct)}% compared to the previous ${rangeDays} days.`);
        } else {
          insights.push(`Throughput is steady compared to the previous ${rangeDays} days.`);
        }
      } else if (completedInRange > 0) {
        insights.push(`${completedInRange} task(s) completed in the last ${rangeDays} days.`);
      }
    } else if (completedDoneCount > 0) {
      insights.push(`${completedDoneCount} task(s) completed overall.`);
    }

    // Insight 3: Average cycle time
    if (avgCycleTimeHours > 0) {
      if (avgCycleTimeHours >= 24) {
        const days = (avgCycleTimeHours / 24).toFixed(1);
        insights.push(`Average cycle time is ${days} days.`);
      } else {
        insights.push(`Average cycle time is ${avgCycleTimeHours} hours.`);
      }
    }

    // Insight 4: High priority open tasks
    const openHighCount = tasks.filter(t => t.priority === 'HIGH' && t.status !== 'DONE').length;
    if (openHighCount > 0) {
      insights.push(`${openHighCount} HIGH priority task${openHighCount > 1 ? 's are' : ' is'} still open.`);
    }

    return res.json({
      summary: {
        total: totalTasks,
        todo: todoTasks,
        in_progress: inProgressTasks,
        done: doneTasks,
        completion_rate: completionRate,
        avg_cycle_time_hours: avgCycleTimeHours,
        avg_lead_time_hours: avgLeadTimeHours,
        completed_in_range: completedInRange,
        completed_in_previous_range: completedInPrevRange,
        overdue_count: overdueCount,
      },
      status_distribution: statusDistribution,
      priority_distribution: priorityDistribution,
      workload: workload,
      throughput: throughput,
      burndown: burndown,
      top_contributors: top_contributors,
      insights: insights.slice(0, 4),
    });
  } catch (err) {
    console.error('Analytics Error:', err);
    return res.status(500).json({ error: 'Failed to compute project analytics' });
  }
};

/**
 * GET /api/projects/:id/analytics/export.csv
 */
const exportProjectCsv = async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this project' });
    }

    const [tasksRes, logsRes] = await Promise.all([
      pool.query(
        `SELECT 
           t.id, t.title, t.status, t.priority, t.created_at, t.updated_at,
           u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON t.assignee_id = u.id
         WHERE t.project_id = $1
         ORDER BY t.id ASC`,
        [projectId]
      ),
      pool.query(
        `SELECT al.task_id, al.action, al.to_status, al.created_at
         FROM activity_logs al
         JOIN tasks t ON al.task_id = t.id
         WHERE t.project_id = $1 AND al.action IN ('CREATED', 'MOVED')
         ORDER BY al.created_at ASC`,
        [projectId]
      )
    ]);

    const tasks = tasksRes.rows;
    const logs = logsRes.rows;

    const taskCompletionMap = new Map();
    const taskStartMap = new Map();

    for (const log of logs) {
      if (log.action === 'CREATED' && log.to_status === 'IN_PROGRESS') {
        if (!taskStartMap.has(log.task_id)) {
          taskStartMap.set(log.task_id, new Date(log.created_at));
        }
      } else if (log.action === 'MOVED') {
        if (log.to_status === 'IN_PROGRESS' && !taskStartMap.has(log.task_id)) {
          taskStartMap.set(log.task_id, new Date(log.created_at));
        }
        if (log.to_status === 'DONE') {
          taskCompletionMap.set(log.task_id, new Date(log.created_at));
        }
      }
    }

    const headers = ['id', 'title', 'status', 'priority', 'assignee', 'created_at', 'completed_at', 'cycle_time_hours'];
    const csvRows = [headers.join(',')];

    for (const t of tasks) {
      const createdAt = new Date(t.created_at);
      let completedAtStr = '';
      let cycleTimeStr = '';

      if (t.status === 'DONE') {
        const completedAt = taskCompletionMap.get(t.id) || new Date(t.updated_at);
        const startedAt = taskStartMap.get(t.id) || createdAt;
        const cycleHours = Math.max(0, (completedAt.getTime() - startedAt.getTime()) / (1000 * 3600));

        completedAtStr = completedAt.toISOString();
        cycleTimeStr = (Math.round(cycleHours * 10) / 10).toString();
      }

      const row = [
        escapeCsvField(t.id),
        escapeCsvField(t.title),
        escapeCsvField(t.status),
        escapeCsvField(t.priority),
        escapeCsvField(t.assignee_name || 'Unassigned'),
        escapeCsvField(createdAt.toISOString()),
        escapeCsvField(completedAtStr),
        escapeCsvField(cycleTimeStr)
      ];

      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-tasks.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV Export Error:', err);
    return res.status(500).json({ error: 'Failed to export project analytics CSV' });
  }
};

module.exports = {
  getProjectAnalytics,
  exportProjectCsv,
};
