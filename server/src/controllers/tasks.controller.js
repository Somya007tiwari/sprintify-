const pool = require('../config/db');
const { z } = require('zod');
const { getMemberRole } = require('./projects.controller');
const { emitToProject } = require('../realtime/socket');
const { notify } = require('../services/notification.service');

const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required'),
  description: z.string().trim().optional().default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  assignee_id: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
  subtasks: z.array(z.string().trim().min(1).max(200)).max(15, 'Maximum 15 subtasks allowed').optional().default([]),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').optional(),
  description: z.string().trim().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  assignee_id: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

const moveTaskSchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  position: z.number().int().min(0, 'Position must be a non-negative integer'),
});

// Helper: fetch task details with project, assignee, comment_count, attachment_count, subtask_total, subtask_done
async function getTaskWithDetails(taskId, client = pool) {
  const query = `
    SELECT 
      t.id, t.title, t.description, t.status, t.priority, t.position,
      t.project_id, t.assignee_id, t.due_date::text AS due_date, t.created_at, t.updated_at,
      u.name AS assignee_name, u.email AS assignee_email,
      (SELECT COUNT(*)::int FROM comments WHERE task_id = t.id) AS comment_count,
      (SELECT COUNT(*)::int FROM attachments WHERE task_id = t.id) AS attachment_count,
      (SELECT COUNT(*)::int FROM subtasks WHERE task_id = t.id) AS subtask_total,
      (SELECT COUNT(*)::int FROM subtasks WHERE task_id = t.id AND done = true) AS subtask_done
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = $1;
  `;
  const res = await client.query(query, [taskId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    position: row.position,
    project_id: row.project_id,
    assignee_id: row.assignee_id,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email } : null,
    due_date: row.due_date || null,
    comment_count: row.comment_count || 0,
    attachment_count: row.attachment_count || 0,
    subtask_total: row.subtask_total || 0,
    subtask_done: row.subtask_done || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/projects/:id/tasks
async function getProjectTasks(req, res, next) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const query = `
      SELECT 
        t.id, t.title, t.description, t.status, t.priority, t.position,
        t.project_id, t.assignee_id, t.due_date::text AS due_date, t.created_at, t.updated_at,
        u.name AS assignee_name, u.email AS assignee_email,
        (SELECT COUNT(*)::int FROM comments WHERE task_id = t.id) AS comment_count,
        (SELECT COUNT(*)::int FROM attachments WHERE task_id = t.id) AS attachment_count,
        (SELECT COUNT(*)::int FROM subtasks WHERE task_id = t.id) AS subtask_total,
        (SELECT COUNT(*)::int FROM subtasks WHERE task_id = t.id AND done = true) AS subtask_done
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1
      ORDER BY t.status ASC, t.position ASC, t.id ASC;
    `;
    const result = await pool.query(query, [projectId]);

    const tasks = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      position: row.position,
      project_id: row.project_id,
      assignee_id: row.assignee_id,
      assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name, email: row.assignee_email } : null,
      due_date: row.due_date || null,
      comment_count: row.comment_count || 0,
      attachment_count: row.attachment_count || 0,
      subtask_total: row.subtask_total || 0,
      subtask_done: row.subtask_done || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/tasks
async function createTask(req, res, next) {
  const client = await pool.connect();
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, description, priority, assignee_id, due_date, subtasks } = req.body;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Validate assignee if provided
    if (assignee_id) {
      const assigneeRole = await getMemberRole(projectId, assignee_id);
      if (!assigneeRole) {
        return res.status(400).json({ error: 'Assignee must be a member of this project.' });
      }
    }

    await client.query('BEGIN');

    // Get max position in TODO column
    const posRes = await client.query(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE project_id = $1 AND status = $2',
      [projectId, 'TODO']
    );
    const position = posRes.rows[0].next_pos;

    // Insert task
    const insertRes = await client.query(
      `INSERT INTO tasks (title, description, status, priority, position, project_id, assignee_id, due_date)
       VALUES ($1, $2, 'TODO', $3, $4, $5, $6, $7) RETURNING id`,
      [title, description || '', priority || 'MEDIUM', position, projectId, assignee_id || null, due_date || null]
    );
    const taskId = insertRes.rows[0].id;

    // Insert subtasks if provided
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      for (let i = 0; i < subtasks.length; i++) {
        await client.query(
          `INSERT INTO subtasks (task_id, title, done, position) VALUES ($1, $2, false, $3)`,
          [taskId, subtasks[i], i]
        );
      }
    }

    // Log activity
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata)
       VALUES ($1, $2, 'CREATED', NULL, 'TODO', $3)`,
      [taskId, userId, JSON.stringify({ title, priority, subtask_count: subtasks ? subtasks.length : 0 })]
    );

    await client.query('COMMIT');

    const createdTask = await getTaskWithDetails(taskId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'task:created', {
      task: createdTask,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Trigger TASK_ASSIGNED notification if assigned
    if (assignee_id) {
      notify({
        userId: assignee_id,
        type: 'TASK_ASSIGNED',
        title: `${req.user.name} assigned you a task`,
        body: title,
        projectId,
        taskId: createdTask.id,
        link: `/projects/${projectId}`,
        actorId: req.user.id,
      });
    }

    return res.status(201).json(createdTask);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/tasks/:id
async function updateTask(req, res, next) {
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, description, priority, assignee_id, due_date } = req.body;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    // Fetch existing task
    const taskRes = await client.query('SELECT t.*, t.due_date::text AS due_date FROM tasks t WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const existingTask = taskRes.rows[0];

    // Verify caller project membership
    const role = await getMemberRole(existingTask.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Validate new assignee if provided and changed
    if (assignee_id !== undefined && assignee_id !== null && assignee_id !== existingTask.assignee_id) {
      const assigneeRole = await getMemberRole(existingTask.project_id, assignee_id);
      if (!assigneeRole) {
        return res.status(400).json({ error: 'Assignee must be a member of this project.' });
      }
    }

    await client.query('BEGIN');

    const newTitle = title !== undefined ? title : existingTask.title;
    const newDesc = description !== undefined ? description : existingTask.description;
    const newPriority = priority !== undefined ? priority : existingTask.priority;
    const newAssigneeId = assignee_id !== undefined ? assignee_id : existingTask.assignee_id;
    const newDueDate = due_date !== undefined ? (due_date ? due_date : null) : existingTask.due_date;

    await client.query(
      `UPDATE tasks 
       SET title = $1, description = $2, priority = $3, assignee_id = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [newTitle, newDesc, newPriority, newAssigneeId, newDueDate, taskId]
    );

    // Determine activity action
    let action = 'UPDATED';
    let metadata = {};
    if (assignee_id !== undefined && assignee_id !== existingTask.assignee_id) {
      action = 'ASSIGNED';
      metadata = { old_assignee_id: existingTask.assignee_id, new_assignee_id: newAssigneeId };
    } else if (due_date !== undefined && newDueDate !== existingTask.due_date) {
      action = 'UPDATED';
      metadata = { field: 'due_date', from: existingTask.due_date, to: newDueDate };
    }

    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [taskId, userId, action, existingTask.status, existingTask.status, JSON.stringify(metadata)]
    );

    await client.query('COMMIT');

    const updatedTask = await getTaskWithDetails(taskId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existingTask.project_id, 'task:updated', {
      task: updatedTask,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Trigger TASK_ASSIGNED notification if assignee changed
    if (newAssigneeId && newAssigneeId !== existingTask.assignee_id) {
      notify({
        userId: newAssigneeId,
        type: 'TASK_ASSIGNED',
        title: `${req.user.name} assigned you a task`,
        body: updatedTask.title,
        projectId: existingTask.project_id,
        taskId,
        link: `/projects/${existingTask.project_id}`,
        actorId: req.user.id,
      });
    }

    return res.status(200).json(updatedTask);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// PATCH /api/tasks/:id/move
async function moveTask(req, res, next) {
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { status: targetStatus, position: targetPos } = req.body;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    await client.query('BEGIN');

    // Fetch current task with FOR UPDATE lock
    const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1 FOR UPDATE', [taskId]);
    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }
    const currentTask = taskRes.rows[0];
    const projectId = currentTask.project_id;
    const srcStatus = currentTask.status;
    const srcPos = currentTask.position;

    // Verify membership
    const role = await getMemberRole(projectId, userId);
    if (!role) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    // 1. Move within the same column
    if (srcStatus === targetStatus) {
      if (srcPos !== targetPos) {
        // Remove task temporarily from sequence
        await client.query('UPDATE tasks SET position = -1 WHERE id = $1', [taskId]);

        if (targetPos < srcPos) {
          // Shift items down between targetPos and srcPos - 1
          await client.query(
            `UPDATE tasks 
             SET position = position + 1 
             WHERE project_id = $1 AND status = $2 AND position >= $3 AND position < $4`,
            [projectId, srcStatus, targetPos, srcPos]
          );
        } else {
          // Shift items up between srcPos + 1 and targetPos
          await client.query(
            `UPDATE tasks 
             SET position = position - 1 
             WHERE project_id = $1 AND status = $2 AND position > $3 AND position <= $4`,
            [projectId, srcStatus, srcPos, targetPos]
          );
        }

        // Set target position
        await client.query(
          'UPDATE tasks SET position = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [targetPos, taskId]
        );
      }
    } else {
      // 2. Move to a different column
      // Shift remaining tasks in source column down to close gap
      await client.query(
        `UPDATE tasks 
         SET position = position - 1 
         WHERE project_id = $1 AND status = $2 AND position > $3`,
        [projectId, srcStatus, srcPos]
      );

      // Make space in destination column at targetPos
      await client.query(
        `UPDATE tasks 
         SET position = position + 1 
         WHERE project_id = $1 AND status = $2 AND position >= $3`,
        [projectId, targetStatus, targetPos]
      );

      // Update moving task
      await client.query(
        `UPDATE tasks 
         SET status = $1, position = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [targetStatus, targetPos, taskId]
      );
    }

    // Ensure positions in both columns are normalized (0, 1, 2...)
    const normalizeColumn = async (status) => {
      const colTasks = await client.query(
        'SELECT id FROM tasks WHERE project_id = $1 AND status = $2 ORDER BY position ASC, updated_at DESC',
        [projectId, status]
      );
      for (let i = 0; i < colTasks.rows.length; i++) {
        await client.query('UPDATE tasks SET position = $1 WHERE id = $2', [i, colTasks.rows[i].id]);
      }
    };

    await normalizeColumn(srcStatus);
    if (srcStatus !== targetStatus) {
      await normalizeColumn(targetStatus);
    }

    // Record activity log
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata)
       VALUES ($1, $2, 'MOVED', $3, $4, $5)`,
      [taskId, userId, srcStatus, targetStatus, JSON.stringify({ from_position: srcPos, to_position: targetPos })]
    );

    await client.query('COMMIT');

    const updatedTask = await getTaskWithDetails(taskId, pool);
    
    const affectedRes = await pool.query(
      'SELECT id, status, position FROM tasks WHERE project_id = $1 AND status IN ($2, $3) ORDER BY status ASC, position ASC',
      [projectId, srcStatus, targetStatus]
    );

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'task:moved', {
      task: updatedTask,
      from_status: srcStatus,
      to_status: targetStatus,
      affected: affectedRes.rows,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json(updatedTask);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// DELETE /api/tasks/:id
async function deleteTask(req, res, next) {
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    const taskRes = await pool.query('SELECT project_id, status, position FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const { project_id, status, position } = taskRes.rows[0];

    const role = await getMemberRole(project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Delete task
    await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);

    // Shift positions of remaining tasks in column
    await pool.query(
      'UPDATE tasks SET position = position - 1 WHERE project_id = $1 AND status = $2 AND position > $3',
      [project_id, status, position]
    );

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(project_id, 'task:deleted', {
      taskId,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:id/activity
async function getTaskActivity(req, res, next) {
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
        a.id, a.task_id, a.user_id, a.action, a.from_status, a.to_status, a.metadata, a.created_at,
        u.name AS user_name, u.email AS user_email
      FROM activity_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.task_id = $1
      ORDER BY a.created_at DESC;
    `;
    const result = await pool.query(query, [taskId]);

    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  getProjectTasks,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  getTaskActivity,
};
