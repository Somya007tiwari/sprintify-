const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Project Analytics Endpoints
router.get('/projects/:id/analytics', analyticsController.getProjectAnalytics);
router.get('/projects/:id/analytics/export.csv', analyticsController.exportProjectCsv);

module.exports = router;
