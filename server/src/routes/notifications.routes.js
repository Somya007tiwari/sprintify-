const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Notifications Endpoints
router.get('/notifications', notificationsController.getNotifications);
router.get('/notifications/unread-count', notificationsController.getUnreadCount);
router.patch('/notifications/:id/read', notificationsController.markAsRead);
router.post('/notifications/mark-all-read', notificationsController.markAllAsRead);

// Notification Preferences Endpoints
router.get('/notification-preferences', notificationsController.getPreferences);
router.patch(
  '/notification-preferences',
  validate(notificationsController.updatePreferencesSchema),
  notificationsController.updatePreferences
);

module.exports = router;
