const pool = require('../config/db');
const { z } = require('zod');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getMemberRole } = require('./projects.controller');
const { emitToProject } = require('../realtime/socket');

const createMeetingSchema = z.object({
  title: z.string().trim().min(1, 'Meeting title is required'),
  description: z.string().trim().optional().default(''),
  scheduled_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'scheduled_at must be a valid ISO date string',
  }),
  duration_minutes: z.number().int().min(5).optional().default(30),
  participant_ids: z.array(z.number().int()).optional().default([]),
});

const createInstantMeetingSchema = z.object({
  title: z.string().trim().optional(),
});

const updateMeetingSchema = z.object({
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.number().int().min(5).optional(),
  notes: z.string().optional(),
});

const rsvpSchema = z.object({
  rsvp: z.enum(['ACCEPTED', 'DECLINED', 'PENDING']),
});

const actionItemSchema = z.object({
  title: z.string().trim().min(1, 'Action item title is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional().default('MEDIUM'),
  assignee_id: z.number().int().nullable().optional(),
});

// Helper: generate random unguessable room name
function generateRoomName(projectId) {
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `sprintify-${projectId}-${randomBytes}`;
}

// Helper: fetch meeting with participants
async function getMeetingDetailsHelper(meetingId) {
  const meetingRes = await pool.query(
    `SELECT m.*, u.name AS creator_name, u.email AS creator_email
     FROM meetings m
     LEFT JOIN users u ON m.created_by = u.id
     WHERE m.id = $1`,
    [meetingId]
  );
  if (meetingRes.rows.length === 0) return null;
  const meeting = meetingRes.rows[0];

  const participantsRes = await pool.query(
    `SELECT u.id, u.name, u.email, mp.rsvp
     FROM meeting_participants mp
     JOIN users u ON mp.user_id = u.id
     WHERE mp.meeting_id = $1
     ORDER BY u.name ASC`,
    [meetingId]
  );

  return {
    ...meeting,
    creator: meeting.created_by ? { id: meeting.created_by, name: meeting.creator_name, email: meeting.creator_email } : null,
    participants: participantsRes.rows,
  };
}

// GET /api/projects/:id/meetings
async function getProjectMeetings(req, res, next) {
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { filter } = req.query;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    let filterClause = '';
    let orderBy = 'ORDER BY m.scheduled_at ASC';

    if (filter === 'upcoming') {
      filterClause = "AND (m.status IN ('SCHEDULED', 'LIVE') AND m.scheduled_at >= NOW() - INTERVAL '15 minutes')";
      orderBy = 'ORDER BY m.scheduled_at ASC';
    } else if (filter === 'past') {
      filterClause = "AND (m.status = 'ENDED' OR m.scheduled_at < NOW() - INTERVAL '15 minutes')";
      orderBy = 'ORDER BY m.scheduled_at DESC';
    }

    const query = `
      SELECT m.*, u.name AS creator_name, u.email AS creator_email
      FROM meetings m
      LEFT JOIN users u ON m.created_by = u.id
      WHERE m.project_id = $1 ${filterClause}
      ${orderBy};
    `;

    const meetingsRes = await pool.query(query, [projectId]);
    const meetings = meetingsRes.rows;

    // Attach participants to each meeting
    const result = await Promise.all(
      meetings.map(async (m) => {
        const partsRes = await pool.query(
          `SELECT u.id, u.name, u.email, mp.rsvp
           FROM meeting_participants mp
           JOIN users u ON mp.user_id = u.id
           WHERE mp.meeting_id = $1
           ORDER BY u.name ASC`,
          [m.id]
        );
        return {
          ...m,
          creator: m.created_by ? { id: m.created_by, name: m.creator_name, email: m.creator_email } : null,
          participants: partsRes.rows,
        };
      })
    );

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// POST /api/projects/:id/meetings
async function createMeeting(req, res, next) {
  const client = await pool.connect();
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, description, scheduled_at, duration_minutes, participant_ids } = req.body;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Validate participant_ids
    if (participant_ids && participant_ids.length > 0) {
      for (const pId of participant_ids) {
        const pRole = await getMemberRole(projectId, pId);
        if (!pRole) {
          return res.status(400).json({ error: `Participant ID ${pId} is not a member of this project.` });
        }
      }
    }

    await client.query('BEGIN');

    const roomName = generateRoomName(projectId);
    const insertRes = await client.query(
      `INSERT INTO meetings 
       (project_id, title, description, scheduled_at, duration_minutes, room_name, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'SCHEDULED', $7) RETURNING id`,
      [projectId, title, description || '', new Date(scheduled_at), duration_minutes || 30, roomName, userId]
    );
    const meetingId = insertRes.rows[0].id;

    // Add creator as ACCEPTED
    await client.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, rsvp) VALUES ($1, $2, 'ACCEPTED')`,
      [meetingId, userId]
    );

    // Add specified participants as PENDING (excluding creator)
    const otherParticipantIds = (participant_ids || []).filter((id) => id !== userId);
    for (const pId of otherParticipantIds) {
      await client.query(
        `INSERT INTO meeting_participants (meeting_id, user_id, rsvp) VALUES ($1, $2, 'PENDING')`,
        [meetingId, pId]
      );
    }

    await client.query('COMMIT');

    const createdMeeting = await getMeetingDetailsHelper(meetingId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'meeting:created', {
      meeting: createdMeeting,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Dispatch meeting notifications
    try {
      const { notify } = require('../services/notification.service');
      for (const pId of otherParticipantIds) {
        notify({
          userId: pId,
          type: 'MEETING_INVITE',
          title: `Meeting invite: ${createdMeeting.title}`,
          body: `${req.user.name} invited you to a meeting on ${new Date(scheduled_at).toLocaleString()}`,
          projectId,
          link: `/projects/${projectId}?meeting=${meetingId}`,
          actorId: userId,
        });
      }
    } catch (notifErr) {
      console.error('Error sending meeting invite notifications:', notifErr);
    }

    return res.status(201).json(createdMeeting);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// POST /api/projects/:id/meetings/instant
async function createInstantMeeting(req, res, next) {
  const client = await pool.connect();
  try {
    const projectId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title } = req.body;

    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const role = await getMemberRole(projectId, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const now = new Date();
    const meetingTitle = title && title.trim() ? title.trim() : `Instant Meeting - ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    await client.query('BEGIN');

    const roomName = generateRoomName(projectId);
    const insertRes = await client.query(
      `INSERT INTO meetings 
       (project_id, title, description, scheduled_at, duration_minutes, room_name, status, created_by, started_at)
       VALUES ($1, $2, '', $3, 30, $4, 'LIVE', $5, $3) RETURNING id`,
      [projectId, meetingTitle, now, roomName, userId]
    );
    const meetingId = insertRes.rows[0].id;

    // Add all project members
    const membersRes = await client.query('SELECT user_id FROM project_members WHERE project_id = $1', [projectId]);
    for (const m of membersRes.rows) {
      const rsvp = m.user_id === userId ? 'ACCEPTED' : 'PENDING';
      await client.query(
        `INSERT INTO meeting_participants (meeting_id, user_id, rsvp) VALUES ($1, $2, $3)`,
        [meetingId, m.user_id, rsvp]
      );
    }

    await client.query('COMMIT');

    const createdMeeting = await getMeetingDetailsHelper(meetingId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(projectId, 'meeting:created', {
      meeting: createdMeeting,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    // Dispatch instant meeting notifications
    try {
      const { notify } = require('../services/notification.service');
      for (const m of membersRes.rows) {
        if (m.user_id !== userId) {
          notify({
            userId: m.user_id,
            type: 'MEETING_INVITE',
            title: `Instant Meeting: ${createdMeeting.title}`,
            body: `${req.user.name} started an instant meeting. Join now!`,
            projectId,
            link: `/projects/${projectId}?meeting=${meetingId}`,
            actorId: userId,
          });
        }
      }
    } catch (notifErr) {
      console.error('Error sending instant meeting notifications:', notifErr);
    }

    return res.status(201).json(createdMeeting);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/meetings/:id
async function getMeetingById(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meeting = await getMeetingDetailsHelper(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const role = await getMemberRole(meeting.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    return res.status(200).json(meeting);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/meetings/:id
async function updateMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, description, scheduled_at, duration_minutes, notes } = req.body;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const existing = meetingRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    // Check if modifying details (other than notes)
    const isEditingDetails = title !== undefined || description !== undefined || scheduled_at !== undefined || duration_minutes !== undefined;

    if (isEditingDetails && existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can edit meeting details.' });
    }

    const newTitle = title !== undefined ? title : existing.title;
    const newDesc = description !== undefined ? description : existing.description;
    const newSched = scheduled_at !== undefined ? new Date(scheduled_at) : existing.scheduled_at;
    const newDur = duration_minutes !== undefined ? duration_minutes : existing.duration_minutes;
    const newNotes = notes !== undefined ? notes : existing.notes;

    await pool.query(
      `UPDATE meetings 
       SET title = $1, description = $2, scheduled_at = $3, duration_minutes = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [newTitle, newDesc, newSched, newDur, newNotes, meetingId]
    );

    const updated = await getMeetingDetailsHelper(meetingId);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/meetings/:id/rsvp
async function rsvpMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { rsvp } = req.body;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT project_id FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });

    const role = await getMemberRole(meetingRes.rows[0].project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    await pool.query(
      `INSERT INTO meeting_participants (meeting_id, user_id, rsvp)
       VALUES ($1, $2, $3)
       ON CONFLICT (meeting_id, user_id) 
       DO UPDATE SET rsvp = $3`,
      [meetingId, userId, rsvp]
    );

    const updated = await getMeetingDetailsHelper(meetingId);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /api/meetings/:id/start
async function startMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const existing = meetingRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    if (existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can start the meeting.' });
    }

    await pool.query(
      `UPDATE meetings SET status = 'LIVE', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [meetingId]
    );

    const updated = await getMeetingDetailsHelper(meetingId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existing.project_id, 'meeting:status', {
      meetingId,
      status: 'LIVE',
      meeting: updated,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /api/meetings/:id/end
async function endMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const existing = meetingRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    if (existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can end the meeting.' });
    }

    await pool.query(
      `UPDATE meetings SET status = 'ENDED', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [meetingId]
    );

    const updated = await getMeetingDetailsHelper(meetingId);
    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existing.project_id, 'meeting:status', {
      meetingId,
      status: 'ENDED',
      meeting: updated,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/meetings/:id
async function deleteMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const existing = meetingRes.rows[0];

    const role = await getMemberRole(existing.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    if (existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can delete the meeting.' });
    }

    await pool.query('DELETE FROM meetings WHERE id = $1', [meetingId]);

    const originSocketId = req.headers['x-socket-id'] || req.headers['X-Socket-Id'];
    emitToProject(existing.project_id, 'meeting:deleted', {
      meetingId,
      actor: { id: req.user.id, name: req.user.name }
    }, originSocketId);

    return res.status(200).json({ message: 'Meeting deleted successfully' });
  } catch (err) {
    next(err);
  }
}

// GET /api/meetings/:id/join
async function joinMeeting(req, res, next) {
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await pool.query('SELECT * FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const meeting = meetingRes.rows[0];

    const role = await getMemberRole(meeting.project_id, userId);
    if (!role) return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });

    const jaasAppId = process.env.JAAS_APP_ID;
    const jaasKid = process.env.JAAS_KID;
    const jaasPrivateKey = process.env.JAAS_PRIVATE_KEY;

    // Default public Jitsi fallback
    const publicJoinUrl = `https://meet.jit.si/${meeting.room_name}`;

    if (jaasAppId && jaasKid && jaasPrivateKey) {
      try {
        const isModerator = meeting.created_by === userId;
        const formattedPrivateKey = jaasPrivateKey.replace(/\\n/g, '\n');

        const nowSec = Math.floor(Date.now() / 1000);
        const payload = {
          aud: 'jitsi',
          iss: 'chat',
          sub: jaasAppId,
          room: meeting.room_name,
          exp: nowSec + 2 * 3600, // 2 hours
          nbf: nowSec - 10,
          context: {
            user: {
              name: req.user.name,
              email: req.user.email,
              id: String(req.user.id),
              moderator: isModerator,
            },
            features: {
              livestreaming: false,
              recording: false,
              transcription: false,
              'outbound-call': false,
            },
          },
        };

        const token = jwt.sign(payload, formattedPrivateKey, {
          algorithm: 'RS256',
          header: {
            kid: jaasKid,
            alg: 'RS256',
            typ: 'JWT',
          },
        });

        const jaasJoinUrl = `https://8x8.vc/${jaasAppId}/${meeting.room_name}`;

        return res.status(200).json({
          provider: 'jaas',
          roomName: meeting.room_name,
          joinUrl: jaasJoinUrl,
          jwt: token,
          appId: jaasAppId,
          meeting,
        });
      } catch (tokenErr) {
        console.warn('Failed to generate JaaS JWT, falling back to public Jitsi:', tokenErr.message);
      }
    }

    return res.status(200).json({
      provider: 'jitsi-public',
      roomName: meeting.room_name,
      joinUrl: publicJoinUrl,
      meeting,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/meetings/:id/action-items
async function createActionItem(req, res, next) {
  const client = await pool.connect();
  try {
    const meetingId = parseInt(req.params.id, 10);
    const userId = req.user.id;
    const { title, priority, assignee_id } = req.body;

    if (isNaN(meetingId)) return res.status(400).json({ error: 'Invalid meeting ID' });

    const meetingRes = await client.query('SELECT project_id, title FROM meetings WHERE id = $1', [meetingId]);
    if (meetingRes.rows.length === 0) return res.status(404).json({ error: 'Meeting not found' });
    const meeting = meetingRes.rows[0];
    const projectId = meeting.project_id;

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
      `INSERT INTO tasks (title, description, status, priority, position, project_id, assignee_id)
       VALUES ($1, $2, 'TODO', $3, $4, $5, $6) RETURNING id`,
      [
        title,
        `Action item from meeting "${meeting.title}"`,
        priority || 'MEDIUM',
        position,
        projectId,
        assignee_id || null,
      ]
    );
    const taskId = insertRes.rows[0].id;

    // Log activity
    await client.query(
      `INSERT INTO activity_logs (task_id, user_id, action, from_status, to_status, metadata)
       VALUES ($1, $2, 'CREATED', NULL, 'TODO', $3)`,
      [
        taskId,
        userId,
        JSON.stringify({ source: 'meeting', meeting_id: meetingId, meeting_title: meeting.title }),
      ]
    );

    await client.query('COMMIT');

    // Fetch created task details
    const taskRes = await pool.query(
      `SELECT t.*, u.name AS assignee_name, u.email AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE t.id = $1`,
      [taskId]
    );

    const createdTask = taskRes.rows[0];
    return res.status(201).json({
      id: createdTask.id,
      title: createdTask.title,
      description: createdTask.description,
      status: createdTask.status,
      priority: createdTask.priority,
      position: createdTask.position,
      project_id: createdTask.project_id,
      assignee_id: createdTask.assignee_id,
      assignee: createdTask.assignee_id ? { id: createdTask.assignee_id, name: createdTask.assignee_name, email: createdTask.assignee_email } : null,
      created_at: createdTask.created_at,
      updated_at: createdTask.updated_at,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  createMeetingSchema,
  createInstantMeetingSchema,
  updateMeetingSchema,
  rsvpSchema,
  actionItemSchema,
  getProjectMeetings,
  createMeeting,
  createInstantMeeting,
  getMeetingById,
  updateMeeting,
  rsvpMeeting,
  startMeeting,
  endMeeting,
  deleteMeeting,
  joinMeeting,
  createActionItem,
};
