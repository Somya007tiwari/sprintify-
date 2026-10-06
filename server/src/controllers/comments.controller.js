const pool = require('../config/db');
const { z } = require('zod');
const { getMemberRole } = require('./projects.controller');
const { emitToProject } = require('../realtime/socket');

const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment text cannot be empty').max(2000, 'Comment text cannot exceed 2000 characters'),
});

const updateCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment text cannot be empty').max(2000, 'Comment text cannot exceed 2000 characters'),
});

// GET /api/tasks/:id/comments
async function getTaskComments(req, res, next) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const role = await getMemberRole(taskRes.rows[0].project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const query = `
      SELECT 
        c.id, c.task_id, c.user_id, c.body, c.created_at, c.updated_at, c.edited,
        u.name AS user_name, u.email AS user_email
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC;
    `;
    const result = await pool.query(query, [taskId]);

    const comments = result.rows.map(r => ({
      id: r.id,
      task_id: r.task_id,
      user_id: r.user_id,
      body: r.body,
      created_at: r.created_at,
      updated_at: r.updated_at,
      edited: r.edited,
      author: r.user_id ? { id: r.user_id, name: r.user_name, email: r.user_email } : { id: 0, name: 'Deleted User', email: '' },
    }));

    return res.status(200).json(comments);
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:id/comments
async function createComment(req, res, next) {
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { body } = req.body;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await client.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const projectId = taskRes.rows[0].project_id;

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO comments (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING *`,
      [taskId, userId, body]
    );
    const comment = insertRes.rows[0];

    // Log activity
    const preview = body.length > 80 ? `${body.substring(0, 80)}...` : body;
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, metadata) VALUES ($1, $2, 'COMMENTED', $3)`,
      [taskId, userId, JSON.stringify({ comment_preview: preview })]
    );

    await client.query('COMMIT');

    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    const author = userRes.rows[0] || { id: userId, name: req.user.name, email: req.user.email };
    const newComment = {
      ...comment,
      author,
    };

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'comment:created', {
      taskId,
      comment: newComment,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Dispatch notifications asynchronously
    (async () => {
      try {
        const { notify } = require('../services/notification.service');
        const taskDataRes = await pool.query('SELECT title, assignee_id FROM tasks WHERE id = $1', [taskId]);
        const taskTitle = taskDataRes.rows[0]?.title || 'Task';
        const assigneeId = taskDataRes.rows[0]?.assignee_id;

        const previousCommentersRes = await pool.query(
          'SELECT DISTINCT user_id FROM comments WHERE task_id = $1 AND user_id IS NOT NULL',
          [taskId]
        );

        const recipientIds = new Set();
        if (assigneeId && assigneeId !== userId) {
          recipientIds.add(assigneeId);
        }
        for (const row of previousCommentersRes.rows) {
          if (row.user_id && row.user_id !== userId) {
            recipientIds.add(row.user_id);
          }
        }

        for (const recipientId of recipientIds) {
          notify({
            userId: recipientId,
            type: 'COMMENT_ADDED',
            title: `${author.name} commented on "${taskTitle}"`,
            body: preview,
            projectId,
            taskId,
            link: `/projects/${projectId}?task=${taskId}`,
            actorId: userId,
          });
        }
      } catch (notifErr) {
        console.error('Error sending comment notifications:', notifErr);
      }
    })();

    return res.status(201).json(newComment);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/comments/:id
async function updateComment(req, res, next) {
  try {
    const commentId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { body } = req.body;

    if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

    const commentRes = await pool.query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (commentRes.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    const comment = commentRes.rows[0];

    if (comment.user_id !== userId) {
      return res.status(403).json({ error: 'Only the comment author can edit this comment.' });
    }

    const updateRes = await pool.query(
      `UPDATE comments SET body = $1, edited = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [body, commentId]
    );
    const updated = updateRes.rows[0];

    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    const updatedComment = {
      ...updated,
      author: userRes.rows[0],
    };

    const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [comment.task_id]);
    const projectId = taskRes.rows[0]?.project_id;
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    if (projectId) {
      emitToProject(projectId, 'comment:updated', {
        taskId: comment.task_id,
        comment: updatedComment,
        actor: { id: req.user.id, name: req.user.name }
      }, originSocketId);
    }

    return res.status(200).json(updatedComment);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comments/:id
async function deleteComment(req, res, next) {
  try {
    const commentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });

    const query = `
      SELECT c.*, t.project_id
      FROM comments c
      JOIN tasks t ON c.task_id = t.id
      WHERE c.id = $1;
    `;
    const commentRes = await pool.query(query, [commentId]);
    if (commentRes.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    const comment = commentRes.rows[0];

    const role = await getMemberRole(comment.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const isAuthor = comment.user_id === userId;
    const isOwner = role === 'OWNER';

    if (!isAuthor && !isOwner) {
      return res.status(403).json({ error: 'Only the comment author or project owner can delete this comment.' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(comment.project_id, 'comment:deleted', {
      taskId: comment.task_id,
      commentId,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCommentSchema,
  updateCommentSchema,
  getTaskComments,
  createComment,
  updateComment,
  deleteComment,
};
