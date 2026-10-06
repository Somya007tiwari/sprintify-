const pool = require('../config/db');
const path = require('path');
const fs = require('fs');
const { getMemberRole } = require('./projects.controller');
const { emitToProject } = require('../realtime/socket');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// GET /api/tasks/:id/attachments
async function getTaskAttachments(req, res, next) {
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
        a.id, a.task_id, a.uploaded_by, a.original_name, a.stored_name, a.mime_type, a.size_bytes, a.created_at,
        u.name AS uploader_name, u.email AS uploader_email
      FROM attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.task_id = $1
      ORDER BY a.created_at DESC;
    `;
    const result = await pool.query(query, [taskId]);

    const attachments = result.rows.map(r => ({
      id: r.id,
      task_id: r.task_id,
      uploaded_by: r.uploaded_by,
      original_name: r.original_name,
      stored_name: r.stored_name,
      mime_type: r.mime_type,
      size_bytes: r.size_bytes,
      created_at: r.created_at,
      uploader: r.uploaded_by ? { id: r.uploaded_by, name: r.uploader_name, email: r.uploader_email } : { id: 0, name: 'Deleted User', email: '' },
    }));

    return res.status(200).json(attachments);
  } catch (err) {
    next(err);
  }
}

// POST /api/tasks/:id/attachments (multipart)
async function uploadAttachments(req, res, next) {
  const client = await pool.connect();
  try {
    const taskId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(taskId)) return res.status(400).json({ error: 'Invalid task ID' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided for upload.' });
    }

    const taskRes = await client.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
    if (taskRes.rows.length === 0) {
      // Clean up uploaded files from disk
      for (const f of req.files) {
        fs.unlink(f.path, () => {});
      }
      return res.status(404).json({ error: 'Task not found' });
    }
    const projectId = taskRes.rows[0].project_id;

    const role = await getMemberRole(projectId, userId);
    if (!role) {
      // Clean up uploaded files
      for (const f of req.files) {
        fs.unlink(f.path, () => {});
      }
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    await client.query('BEGIN');

    const createdAttachments = [];
    for (const file of req.files) {
      // Sanitize original_name for safe header & display
      const sanitizedName = path.basename(file.originalname).replace(/[\r\n]/g, '');

      const insertRes = await client.query(
        `INSERT INTO attachments (task_id, uploaded_by, original_name, stored_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [taskId, userId, sanitizedName, file.filename, file.mimetype, file.size]
      );
      createdAttachments.push(insertRes.rows[0]);
    }

    // Log activity
    const firstFileName = createdAttachments[0]?.original_name || 'file';
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, metadata) VALUES ($1, $2, 'ATTACHED', $3)`,
      [
        taskId,
        userId,
        JSON.stringify({ name: firstFileName, count: createdAttachments.length }),
      ]
    );

    await client.query('COMMIT');

    const userRes = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
    const uploader = userRes.rows[0];

    const result = createdAttachments.map(a => ({
      ...a,
      uploader,
    }));

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'attachment:added', {
      taskId,
      attachments: result,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(201).json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    if (req.files) {
      for (const f of req.files) {
        fs.unlink(f.path, () => {});
      }
    }
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/attachments/:id/download
async function downloadAttachment(req, res, next) {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(attachmentId)) return res.status(400).json({ error: 'Invalid attachment ID' });

    const query = `
      SELECT a.*, t.project_id
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE a.id = $1;
    `;
    const result = await pool.query(query, [attachmentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });
    const attachment = result.rows[0];

    const role = await getMemberRole(attachment.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const filePath = path.join(UPLOADS_DIR, attachment.stored_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const safeFilename = encodeURIComponent(attachment.original_name);
    const isImage = attachment.mime_type.startsWith('image/') || attachment.mime_type === 'application/pdf' || attachment.mime_type === 'text/plain';

    res.setHeader('Content-Type', attachment.mime_type);
    if (isImage) {
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    }

    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/attachments/:id
async function deleteAttachment(req, res, next) {
  try {
    const attachmentId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(attachmentId)) return res.status(400).json({ error: 'Invalid attachment ID' });

    const query = `
      SELECT a.*, t.project_id
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE a.id = $1;
    `;
    const result = await pool.query(query, [attachmentId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Attachment not found' });
    const attachment = result.rows[0];

    const role = await getMemberRole(attachment.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const isUploader = attachment.uploaded_by === userId;
    const isOwner = role === 'OWNER';

    if (!isUploader && !isOwner) {
      return res.status(403).json({ error: 'Only the uploader or project owner can delete this attachment.' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, attachment.stored_name);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }

    // Delete DB row
    await pool.query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(attachment.project_id, 'attachment:deleted', {
      taskId: attachment.task_id,
      attachmentId,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json({ message: 'Attachment deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTaskAttachments,
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
};
