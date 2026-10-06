const pool = require('../config/db');
const { z } = require('zod');

const searchSchema = z.object({
  q: z.string().trim().min(2, 'Search query must be at least 2 characters').max(100, 'Search query cannot exceed 100 characters'),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

// Helper to escape SQL LIKE wildcards
function escapeLike(str) {
  return str.replace(/[%_\\]/g, '\\$&');
}

// GET /api/search?q=<text>&limit=8
async function globalSearch(req, res, next) {
  try {
    const parseResult = searchSchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { q, limit } = parseResult.data;
    const userId = req.user.id;

    const cleanInput = q.toLowerCase();
    const escapedInput = escapeLike(q);
    const containsParam = `%${escapedInput}%`;
    const prefixParam = `${escapedInput}%`;

    // 1. Search Projects
    const projectsQuery = `
      SELECT 
        p.id,
        p.title,
        p.description,
        (SELECT COUNT(*)::int FROM tasks WHERE project_id = p.id) AS task_count,
        CASE 
          WHEN LOWER(p.title) = $2 THEN 1
          WHEN LOWER(p.title) LIKE $3 THEN 2
          WHEN LOWER(p.title) LIKE $4 THEN 3
          ELSE 4
        END AS rank
      FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = $1
        AND (p.title ILIKE $4 OR p.description ILIKE $4)
      ORDER BY rank ASC, p.updated_at DESC
      LIMIT $5;
    `;

    // 2. Search Tasks
    const tasksQuery = `
      SELECT 
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        t.updated_at,
        p.title AS project_title,
        u.id AS assignee_id,
        u.name AS assignee_name,
        CASE 
          WHEN LOWER(t.title) = $2 THEN 1
          WHEN LOWER(t.title) LIKE $3 THEN 2
          WHEN LOWER(t.title) LIKE $4 THEN 3
          ELSE 4
        END AS rank
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE pm.user_id = $1
        AND (t.title ILIKE $4 OR t.description ILIKE $4)
      ORDER BY rank ASC, t.updated_at DESC
      LIMIT $5;
    `;

    const [projectsRes, tasksRes] = await Promise.all([
      pool.query(projectsQuery, [userId, cleanInput, prefixParam, containsParam, limit]),
      pool.query(tasksQuery, [userId, cleanInput, prefixParam, containsParam, limit]),
    ]);

    const formattedProjects = projectsRes.rows.map((r) => {
      let snippet = r.description || '';
      if (snippet.length > 100) {
        snippet = snippet.substring(0, 100) + '...';
      }
      return {
        id: r.id,
        title: r.title,
        description_snippet: snippet,
        task_count: r.task_count,
      };
    });

    const formattedTasks = tasksRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      due_date: r.due_date ? r.due_date : null,
      project_id: r.project_id,
      project_title: r.project_title,
      assignee: r.assignee_id ? { id: r.assignee_id, name: r.assignee_name } : null,
    }));

    return res.status(200).json({
      projects: formattedProjects,
      tasks: formattedTasks,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchSchema,
  globalSearch,
};
