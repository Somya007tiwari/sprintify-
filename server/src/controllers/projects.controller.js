const pool = require('../config/db');
const { z } = require('zod');
const { emitToProject } = require('../realtime/socket');

const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'Project title is required'),
  description: z.string().trim().optional().default(''),
});

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid member email address'),
});

// Helper: Check membership and return member role or null
async function getMemberRole(projectId, userId) {
  const result = await pool.query(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].role : null;
}

// GET /api/projects
async function getProjects(req, res, next) {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        p.id,
        p.title,
        p.description,
        p.created_by,
        p.created_at,
        p.updated_at,
        pm.role,
        (SELECT COUNT(*)::int FROM project_members WHERE project_id = p.id) AS member_count,
        (SELECT COUNT(*)::int FROM tasks WHERE project_id = p.id) AS task_count
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
      ORDER BY p.updated_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/projects
async function createProject(req, res, next) {
  const client = await pool.connect();
  try {
    const { title, description } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Create project
    const projectRes = await client.query(
      'INSERT INTO projects (title, description, created_by) VALUES ($1, $2, $3) RETURNING *',
      [title, description || '', userId]
    );
    const project = projectRes.rows[0];

    // Add creator as OWNER in project_members
    await client.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, userId, 'OWNER']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      ...project,
      role: 'OWNER',
      member_count: 1,
      task_count: 0
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/projects/:id
async function getProjectById(req, res, next) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Check membership
    const role = await getMemberRole(projectId, userId);
    if (!role) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    // Get project details
    const projectRes = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project members
    const membersRes = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role 
       FROM project_members pm 
       JOIN users u ON pm.user_id = u.id 
       WHERE pm.project_id = $1 
       ORDER BY pm.role ASC, u.name ASC`,
      [projectId]
    );

    return res.status(200).json({
      ...projectRes.rows[0],
      current_user_role: role,
      members: membersRes.rows
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/members
async function addProjectMember(req, res, next) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { email } = req.body;

    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    // Verify caller is OWNER
    const callerRole = await getMemberRole(projectId, userId);
    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }
    if (callerRole !== 'OWNER') {
      return res.status(403).json({ error: 'Only project owners can add new members.' });
    }

    // Find user to add
    const userRes = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User with this email does not exist.' });
    }
    const targetUser = userRes.rows[0];

    // Check if already member
    const existingMember = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, targetUser.id]
    );
    if (existingMember.rows.length > 0) {
      return res.status(409).json({ error: 'User is already a member of this project.' });
    }

    // Insert new member
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [projectId, targetUser.id, 'MEMBER']
    );

    // Return updated members list
    const updatedMembersRes = await pool.query(
      `SELECT u.id, u.name, u.email, pm.role 
       FROM project_members pm 
       JOIN users u ON pm.user_id = u.id 
       WHERE pm.project_id = $1 
       ORDER BY pm.role ASC, u.name ASC`,
      [projectId]
    );

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'member:added', {
      member: { id: targetUser.id, name: targetUser.name, email: targetUser.email, role: 'MEMBER' },
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Dispatch notification
    try {
      const { notify } = require('../services/notification.service');
      const projectTitleRes = await pool.query('SELECT title FROM projects WHERE id = $1', [projectId]);
      const projectTitle = projectTitleRes.rows[0]?.title || 'Project';
      notify({
        userId: targetUser.id,
        type: 'ADDED_TO_PROJECT',
        title: `You were added to project "${projectTitle}"`,
        body: `${req.user.name} added you to project "${projectTitle}".`,
        projectId,
        link: `/projects/${projectId}`,
        actorId: userId,
      });
    } catch (notifErr) {
      console.error('Error sending member notification:', notifErr);
    }

    return res.status(201).json({
      message: 'Member added successfully',
      members: updatedMembersRes.rows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProjectSchema,
  addMemberSchema,
  getProjects,
  createProject,
  getProjectById,
  addProjectMember,
  getMemberRole,
};
