const pool = require('../config/db');
const { emitToUser } = require('../realtime/socket');
const { sendNotificationEmail } = require('./email.service');

/**
 * Lazily fetches or creates default notification preferences for a user
 */
async function getOrCreatePreferences(userId) {
  const res = await pool.query(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId]
  );
  if (res.rows.length > 0) {
    return res.rows[0];
  }

  const insertRes = await pool.query(
    `INSERT INTO notification_preferences 
     (user_id, in_app_enabled, email_enabled, email_on_assigned, email_on_due, email_on_comment)
     VALUES ($1, true, false, true, true, false)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );

  if (insertRes.rows.length > 0) {
    return insertRes.rows[0];
  }

  // Fallback re-query
  const reQuery = await pool.query(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId]
  );
  return reQuery.rows[0] || {
    user_id: userId,
    in_app_enabled: true,
    email_enabled: false,
    email_on_assigned: true,
    email_on_due: true,
    email_on_comment: false,
  };
}

/**
 * Dispatch a notification to a specific user according to their preferences.
 */
async function notify({ userId, type, title, body, projectId, taskId, link, dedupeKey, actorId }) {
  try {
    // 1. Never notify actor about their own action
    if (actorId && Number(userId) === Number(actorId)) {
      return;
    }

    const targetUserId = Number(userId);
    if (!targetUserId) return;

    // 2. Fetch user notification preferences
    const prefs = await getOrCreatePreferences(targetUserId);

    let insertedNotification = null;

    // 3. In-app notification creation
    if (prefs.in_app_enabled !== false) {
      const insertQuery = `
        INSERT INTO notifications (user_id, type, title, body, project_id, task_id, link, dedupe_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, dedupe_key) DO NOTHING
        RETURNING *;
      `;
      const res = await pool.query(insertQuery, [
        targetUserId,
        type,
        title,
        body || null,
        projectId || null,
        taskId || null,
        link || null,
        dedupeKey || null,
      ]);

      if (res.rows.length > 0) {
        insertedNotification = res.rows[0];
      }
    }

    // 4. Emit live Socket.io event if inserted
    if (insertedNotification) {
      const unreadRes = await pool.query(
        'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [targetUserId]
      );
      const unreadCount = unreadRes.rows[0]?.unread_count || 0;

      emitToUser(targetUserId, 'notification:new', {
        notification: insertedNotification,
        unread_count: unreadCount,
      });
    }

    // 5. Check Email dispatch
    let shouldSendEmail = false;
    if (prefs.email_enabled) {
      if (type === 'TASK_ASSIGNED' && prefs.email_on_assigned) shouldSendEmail = true;
      else if ((type === 'TASK_DUE_SOON' || type === 'TASK_OVERDUE') && prefs.email_on_due) shouldSendEmail = true;
      else if (type === 'COMMENT_ADDED' && prefs.email_on_comment) shouldSendEmail = true;
      else if (type === 'ADDED_TO_PROJECT' || type === 'MEETING_INVITE') shouldSendEmail = true;
    }

    if (shouldSendEmail) {
      const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [targetUserId]);
      if (userRes.rows.length > 0 && userRes.rows[0].email) {
        // Asynchronous fire-and-forget
        sendNotificationEmail({
          to: userRes.rows[0].email,
          subject: title,
          title,
          body,
          link,
        }).catch(err => console.warn('[Notification Email Warning]:', err.message));
      }
    }
  } catch (err) {
    console.error('[Notification Service Error]:', err);
  }
}

module.exports = {
  getOrCreatePreferences,
  notify,
};
