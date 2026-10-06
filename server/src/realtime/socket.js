const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let io = null;

// Map<projectId, Map<userId, { id, name, count }>>
const projectOnlineUsers = new Map();

function getProjectOnlineUsers(projectId) {
  const pMap = projectOnlineUsers.get(Number(projectId));
  if (!pMap) return [];
  return Array.from(pMap.values()).map(u => ({ id: u.id, name: u.name }));
}

function addUserToProjectPresence(projectId, user) {
  const pId = Number(projectId);
  if (!projectOnlineUsers.has(pId)) {
    projectOnlineUsers.set(pId, new Map());
  }
  const pMap = projectOnlineUsers.get(pId);
  if (pMap.has(user.id)) {
    pMap.get(user.id).count += 1;
  } else {
    pMap.set(user.id, { id: user.id, name: user.name, count: 1 });
  }
}

function removeUserFromProjectPresence(projectId, userId) {
  const pId = Number(projectId);
  const pMap = projectOnlineUsers.get(pId);
  if (!pMap) return;
  if (pMap.has(userId)) {
    const u = pMap.get(userId);
    u.count -= 1;
    if (u.count <= 0) {
      pMap.delete(userId);
    }
  }
  if (pMap.size === 0) {
    projectOnlineUsers.delete(pId);
  }
}

function initSocket(httpServer) {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

  io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      credentials: true
    }
  });

  // JWT Authentication Middleware for Socket.io
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        return next(new Error('Authentication token missing'));
      }
      const jwtSecret = process.env.JWT_SECRET || 'sprintify_super_secret_jwt_key_2026';
      const decoded = jwt.verify(token, jwtSecret);
      socket.user = { id: decoded.id, name: decoded.name };
      next();
    } catch (err) {
      console.error('[Socket Auth Error]:', err.message);
      return next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket Connected] Socket ID: ${socket.id} | User: ${socket.user.name} (ID: ${socket.user.id})`);
    
    // Join personal user room for targeted notifications
    if (socket.user && socket.user.id) {
      socket.join(`user:${socket.user.id}`);
    }

    // Track joined projects on this socket
    socket.joinedProjects = new Set();
    socket.lastTypingTimestamp = 0;

    // Join Project Room
    socket.on('project:join', async ({ projectId }, callback) => {
      try {
        const pId = Number(projectId);
        if (!pId) {
          if (typeof callback === 'function') callback({ ok: false, error: 'Invalid project ID' });
          return;
        }

        // DB check membership
        const memberRes = await pool.query(
          'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
          [pId, socket.user.id]
        );

        if (memberRes.rows.length === 0) {
          if (typeof callback === 'function') callback({ ok: false, error: 'Not a member of this project' });
          return;
        }

        const roomName = `project:${pId}`;
        socket.join(roomName);
        socket.joinedProjects.add(pId);

        // Update presence
        addUserToProjectPresence(pId, socket.user);
        const onlineUsers = getProjectOnlineUsers(pId);

        // Emit updated presence to room
        io.to(roomName).emit('presence:update', {
          projectId: pId,
          users: onlineUsers
        });

        console.log(`[Socket Room] User ${socket.user.name} joined room ${roomName}`);
        if (typeof callback === 'function') callback({ ok: true });
      } catch (err) {
        console.error('[Socket project:join Error]:', err);
        if (typeof callback === 'function') callback({ ok: false, error: 'Server error joining room' });
      }
    });

    // Leave Project Room
    socket.on('project:leave', ({ projectId }) => {
      const pId = Number(projectId);
      if (!pId) return;

      const roomName = `project:${pId}`;
      socket.leave(roomName);
      if (socket.joinedProjects.has(pId)) {
        socket.joinedProjects.delete(pId);
        removeUserFromProjectPresence(pId, socket.user.id);
        const onlineUsers = getProjectOnlineUsers(pId);
        io.to(roomName).emit('presence:update', {
          projectId: pId,
          users: onlineUsers
        });
        console.log(`[Socket Room] User ${socket.user.name} left room ${roomName}`);
      }
    });

    // Typing indicator
    socket.on('comment:typing', ({ projectId, taskId }) => {
      const now = Date.now();
      if (now - socket.lastTypingTimestamp < 1000) {
        return; // Rate-limit to max 1 per sec per socket
      }
      socket.lastTypingTimestamp = now;

      const pId = Number(projectId);
      if (!pId || !taskId) return;

      const roomName = `project:${pId}`;
      socket.to(roomName).emit('comment:typing', {
        taskId: Number(taskId),
        user: socket.user
      });
    });

    // Disconnect Handler
    socket.on('disconnect', (reason) => {
      console.log(`[Socket Disconnected] Socket ID: ${socket.id} | User: ${socket.user.name} | Reason: ${reason}`);
      socket.joinedProjects.forEach((pId) => {
        removeUserFromProjectPresence(pId, socket.user.id);
        const onlineUsers = getProjectOnlineUsers(pId);
        io.to(`project:${pId}`).emit('presence:update', {
          projectId: pId,
          users: onlineUsers
        });
      });
      socket.joinedProjects.clear();
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitToProject(projectId, event, payload, originSocketId) {
  if (!io) return;
  const pId = Number(projectId);
  const roomName = `project:${pId}`;

  const enrichedPayload = {
    ...payload,
    projectId: pId
  };

  if (originSocketId) {
    io.to(roomName).except(originSocketId).emit(event, enrichedPayload);
  } else {
    io.to(roomName).emit(event, enrichedPayload);
  }
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  const uId = Number(userId);
  if (uId) {
    io.to(`user:${uId}`).emit(event, payload);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitToProject,
  emitToUser,
  getProjectOnlineUsers
};
