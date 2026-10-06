const pool = require('../config/db');
const { notify } = require('../services/notification.service');

let intervalId = null;
let isJobRunning = false;

/**
 * Check open tasks due today, tomorrow, or overdue, and dispatch notification reminders.
 */
async function checkDueTaskReminders() {
  if (isJobRunning) return;
  isJobRunning = true;

  try {
    const todayStr = new Date().toISOString().substring(0, 10);

    // Fetch open tasks (status != 'DONE') with an assignee and a due_date
    const res = await pool.query(
      `SELECT t.id, t.title, t.project_id, t.assignee_id, t.due_date::text AS due_date, t.status
       FROM tasks t
       WHERE t.status != 'DONE' 
         AND t.assignee_id IS NOT NULL 
         AND t.due_date IS NOT NULL
         AND t.due_date <= (CURRENT_DATE + INTERVAL '1 day')`
    );

    for (const task of res.rows) {
      const taskDueDate = task.due_date; // YYYY-MM-DD
      const isOverdue = taskDueDate < todayStr;

      if (isOverdue) {
        const dedupeKey = `overdue:${task.id}:${taskDueDate}`;
        await notify({
          userId: task.assignee_id,
          type: 'TASK_OVERDUE',
          title: 'Task overdue!',
          body: `"${task.title}" was due on ${taskDueDate}.`,
          projectId: task.project_id,
          taskId: task.id,
          link: `/projects/${task.project_id}`,
          dedupeKey,
        });
      } else {
        // Due today or tomorrow
        const dedupeKey = `due_soon:${task.id}:${taskDueDate}`;
        const isToday = taskDueDate === todayStr;
        const dueLabel = isToday ? 'today' : 'tomorrow';

        await notify({
          userId: task.assignee_id,
          type: 'TASK_DUE_SOON',
          title: 'Task due soon',
          body: `"${task.title}" is due ${dueLabel}.`,
          projectId: task.project_id,
          taskId: task.id,
          link: `/projects/${task.project_id}`,
          dedupeKey,
        });
      }
    }
  } catch (err) {
    console.error('[Due Reminders Job Error]:', err);
  } finally {
    isJobRunning = false;
  }
}

/**
 * Start the 30-minute due reminders scheduler job
 */
function startDueRemindersJob() {
  // Run once immediately on start
  checkDueTaskReminders();

  // Run every 30 minutes (30 * 60 * 1000 ms)
  intervalId = setInterval(checkDueTaskReminders, 30 * 60 * 1000);
  console.log('[Due Reminders Scheduler] Started job (runs every 30 mins).');
}

/**
 * Gracefully stop scheduler interval
 */
function stopDueRemindersJob() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Due Reminders Scheduler] Stopped job.');
  }
}

module.exports = {
  startDueRemindersJob,
  stopDueRemindersJob,
  checkDueTaskReminders,
};
