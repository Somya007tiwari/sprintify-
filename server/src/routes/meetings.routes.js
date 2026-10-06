const express = require('express');
const router = express.Router();
const meetingsController = require('../controllers/meetings.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Project meetings endpoints
router.get('/projects/:id/meetings', meetingsController.getProjectMeetings);
router.post('/projects/:id/meetings', validate(meetingsController.createMeetingSchema), meetingsController.createMeeting);
router.post('/projects/:id/meetings/instant', validate(meetingsController.createInstantMeetingSchema), meetingsController.createInstantMeeting);

// Individual meeting endpoints
router.get('/meetings/:id', meetingsController.getMeetingById);
router.patch('/meetings/:id', validate(meetingsController.updateMeetingSchema), meetingsController.updateMeeting);
router.patch('/meetings/:id/rsvp', validate(meetingsController.rsvpSchema), meetingsController.rsvpMeeting);
router.post('/meetings/:id/start', meetingsController.startMeeting);
router.post('/meetings/:id/end', meetingsController.endMeeting);
router.delete('/meetings/:id', meetingsController.deleteMeeting);
router.get('/meetings/:id/join', meetingsController.joinMeeting);
router.post('/meetings/:id/action-items', validate(meetingsController.actionItemSchema), meetingsController.createActionItem);

module.exports = router;
