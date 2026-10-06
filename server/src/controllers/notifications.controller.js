const pool = require('../config/db');
const { z } = require('zod');
const { getOrCreatePreferences } = require('../services/notification.service');

const updatePreferencesSchema = z.object({
  in_app_enabled: z.boolean().optional(),
  email_enabled: z.boolean().optional(),
  email_on_assigned: z.boolean().optional(),
  email_on_due: z.boolean().optional(),
  email_on_comment: z.boolean().optional(),
});

/**
 * GET /api/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const unreadOnly = req.query.unread_only === 'true';
    const filterClause = unreadOnly ? 'AND n.read_at IS NULL' : '';

    const [notifRes, unreadRes] = await Promise.all([
      pool.query(
        `SELECT n.id, n.user_id, n.type, n.title, n.body, n.project_id, n.task_id, n.link, n.read_at, n.created_at,
                p.title AS project_title
         FROM notifications n
         LEFT JOIN projects p ON n.project_id = p.id
         WHERE n.user_id = $1 ${filterClause}
         ORDER BY n.created_at DESC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
        [userId]
      ),
    ]);

    return res.json({
      notifications: notifRes.rows,
      unread_count: unreadRes.rows[0]?.unread_count || 0,
    });
  } catch (err) {
    console.error('Get Notifications Error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

/**
 * GET /api/notifications/unread-count
 */
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const resCount = await pool.query(
      'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    return res.json({ unread_count: resCount.rows[0]?.unread_count || 0 });
  } catch (err) {
    console.error('Get Unread Count Error:', err);
    return res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
const markAsRead = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }

    const updatedRes = await pool.query(
      `UPDATE notifications 
       SET read_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (updatedRes.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const unreadRes = await pool.query(
      'SELECT COUNT(*)::int AS unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [userId]
    );

    return res.json({
      notification: updatedRes.rows[0],
      unread_count: unreadRes.rows[0]?.unread_count || 0,
    });
  } catch (err) {
    console.error('Mark Notification Read Error:', err);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

/**
 * POST /api/notifications/mark-all-read
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `UPDATE notifications 
       SET read_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );

    return res.json({ message: 'All notifications marked as read', unread_count: 0 });
  } catch (err) {
    console.error('Mark All Read Error:', err);
    return res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
};

/**
 * GET /api/notification-preferences
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const prefs = await getOrCreatePreferences(userId);
    return res.json(prefs);
  } catch (err) {
    console.error('Get Preferences Error:', err);
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
};

/**
 * PATCH /api/notification-preferences
 */
const updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentPrefs = await getOrCreatePreferences(userId);

    const parseResult = updatePreferencesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const data = parseResult.data;

    const updatedRes = await pool.query(
      `UPDATE notification_preferences
       SET in_app_enabled = COALESCE($2, in_app_enabled),
           email_enabled = COALESCE($3, email_enabled),
           email_on_assigned = COALESCE($4, email_on_assigned),
           email_on_due = COALESCE($5, email_on_due),
           email_on_comment = COALESCE($6, email_on_comment)
       WHERE user_id = $1
       RETURNING *`,
      [
        userId,
        data.in_app_enabled,
        data.email_enabled,
        data.email_on_assigned,
        data.email_on_due,
        data.email_on_comment,
      ]
    );

    return res.json(updatedRes.rows[0] || currentPrefs);
  } catch (err) {
    console.error('Update Preferences Error:', err);
    return res.status(500).json({ error: 'Failed to update notification preferences' });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPreferences,
  updatePreferences,
  updatePreferencesSchema,
};
