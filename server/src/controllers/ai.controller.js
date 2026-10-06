const { z } = require('zod');
const { getMemberRole } = require('./projects.controller');
const { isAiConfigured, checkUserRateLimit, generateTaskAssist } = require('../services/ai.service');

const taskAssistSchema = z.object({
  title: z.string().trim().min(3, 'Task title must be at least 3 characters long').max(200, 'Title cannot exceed 200 characters'),
  type: z.enum(['TASK', 'BUG']),
  existing_description: z.string().trim().max(2000, 'Existing description cannot exceed 2000 characters').optional().default(''),
  mode: z.enum(['GENERATE', 'IMPROVE', 'SUBTASKS_ONLY']),
});

// GET /api/ai/status
function getAiStatus(req, res) {
  return res.status(200).json({ enabled: isAiConfigured() });
}

// POST /api/projects/:id/ai/task-assist
async function taskAssist(req, res, next) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    // Check project membership
    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Check AI configuration
    if (!isAiConfigured()) {
      return res.status(400).json({ error: 'AI Assistant is not configured on the server.' });
    }

    // Check Rate Limiting
    const rateLimitCheck = checkUserRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({ error: rateLimitCheck.message });
    }

    const { title, type, existing_description, mode } = req.body;

    const result = await generateTaskAssist({
      title,
      type,
      existing_description,
      mode,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = {
  taskAssistSchema,
  getAiStatus,
  taskAssist,
};
