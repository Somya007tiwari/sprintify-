const pool = require('../config/db');
const { z } = require('zod');
const { getMemberRole } = require('./projects.controller');
const { emitToProject } = require('../realtime/socket');

const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title cannot be empty').max(200, 'Subtask title cannot exceed 200 characters'),
});

const bulkCreateSubtaskSchema = z.object({
  titles: z.array(
    z.string().trim().min(1, 'Subtask title cannot be empty').max(200, 'Subtask title cannot exceed 200 characters')
  ).min(1, 'At least one subtask title required').max(15, 'Maximum 15 subtasks allowed in bulk creation'),
});

const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Subtask title cannot be empty').max(200, 'Subtask title cannot exceed 200 characters').optional(),
  done: z.boolean().optional(),
});

// GET /api/tasks/:id/subtasks
async function getTaskSubtasks(req, res, next) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const role = await getMemberRole(taskRes.rows[0].project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const query = `
      SELECT id, task_id, title, done, position, created_at, updated_at
      FROM subtasks
      WHERE task_id = $1
      ORDER BY position ASC, id ASC;
    `;
    const result = await pool.query(query, [taskId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:id/subtasks
async function createSubtask(req, res, next) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title } = req.body;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await pool.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const projectId = taskRes.rows[0].project_id;

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const posRes = await pool.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM subtasks WHERE task_id = $1',
      [taskId]
    );
    const nextPos = posRes.rows[0].next_pos;

    const insertRes = await pool.query(
      `INSERT INTO subtasks (task_id, title, done, position)
       VALUES ($1, $2, false, $3) RETURNING *`,
      [taskId, title, nextPos]
    );
    const createdSubtask = insertRes.rows[0];

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'subtask:created', {
      taskId,
      subtask: createdSubtask,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(201).json(createdSubtask);
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:id/subtasks/bulk
async function bulkCreateSubtasks(req, res, next) {
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { titles } = req.body;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await client.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const projectId = taskRes.rows[0].project_id;

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    await client.query('BEGIN');

    const posRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM subtasks WHERE task_id = $1',
      [taskId]
    );
    let startPos = posRes.rows[0].next_pos;

    const createdSubtasks = [];
    for (const title of titles) {
      const insertRes = await client.query(
        `INSERT INTO subtasks (task_id, title, done, position)
         VALUES ($1, $2, false, $3) RETURNING *`,
        [taskId, title, startPos++]
      );
      createdSubtasks.push(insertRes.rows[0]);
    }

    await client.query('COMMIT');

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    for (const subtask of createdSubtasks) {
      emitToProject(projectId, 'subtask:created', {
        taskId,
        subtask,
        actor: { id: req.user.id, name: req.user.name }
      }, originSocketId);
    }

    return res.status(201).json(createdSubtasks);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/subtasks/:id
async function updateSubtask(req, res, next) {
  const client = await pool.connect();
  try {
    const subtaskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, done } = req.body;

    if (isNaN(subtaskId)) return res.status(400).json({ error: 'Invalid subtask ID' });

    const subtaskRes = await client.query(
      `SELECT s.*, t.project_id
       FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = $1`,
      [subtaskId]
    );

    if (subtaskRes.rows.length === 0) return res.status(404).json({ error: 'Subtask not found' });
    const existing = subtaskRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    await client.query('BEGIN');

    const newTitle = title !== undefined ? title : existing.title;
    const newDone = done !== undefined ? done : existing.done;

    const updateRes = await client.query(
      `UPDATE subtasks
       SET title = $1, done = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 RETURNING *`,
      [newTitle, newDone, subtaskId]
    );
    const updatedSubtask = updateRes.rows[0];

    // Log activity if subtask completed (done became true)
    if (done === true && !existing.done) {
      await client.query(
        `INSERT INTO activity_logs (task_id, user_id, action, metadata)
         VALUES ($1, $2, 'SUBTASK_DONE', $3)`,
        [existing.task_id, userId, JSON.stringify({ subtask_title: newTitle })]
      );
    }

    await client.query('COMMIT');

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existing.project_id, 'subtask:updated', {
      taskId: existing.task_id,
      subtask: updatedSubtask,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json(updatedSubtask);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// DELETE /api/subtasks/:id
async function deleteSubtask(req, res, next) {
  try {
    const subtaskId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(subtaskId)) return res.status(400).json({ error: 'Invalid subtask ID' });

    const subtaskRes = await pool.query(
      `SELECT s.*, t.project_id
       FROM subtasks s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = $1`,
      [subtaskId]
    );

    if (subtaskRes.rows.length === 0) return res.status(404).json({ error: 'Subtask not found' });
    const existing = subtaskRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    await pool.query('DELETE FROM subtasks WHERE id = $1', [subtaskId]);

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existing.project_id, 'subtask:deleted', {
      taskId: existing.task_id,
      subtaskId,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json({ message: 'Subtask deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSubtaskSchema,
  bulkCreateSubtaskSchema,
  updateSubtaskSchema,
  getTaskSubtasks,
  createSubtask,
  bulkCreateSubtasks,
  updateSubtask,
  deleteSubtask,
};
