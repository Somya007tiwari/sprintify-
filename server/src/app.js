const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const projectsRoutes = require('./routes/projects.routes');
const tasksRoutes = require('./routes/tasks.routes');
const meetingsRoutes = require('./routes/meetings.routes');
const commentsRoutes = require('./routes/comments.routes');
const attachmentsRoutes = require('./routes/attachments.routes');
const subtasksRoutes = require('./routes/subtasks.routes');
const aiRoutes = require('./routes/ai.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const searchRoutes = require('./routes/search.routes');

const app = express();

// Security & Logging Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api', tasksRoutes);
app.use('/api', meetingsRoutes);
app.use('/api', commentsRoutes);
app.use('/api', attachmentsRoutes);
app.use('/api', subtasksRoutes);
app.use('/api', aiRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/search', searchRoutes);

// Centralized Error Handling
app.use(errorHandler);

module.exports = app;
