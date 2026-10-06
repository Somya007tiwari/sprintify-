const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { taskAssistSchema, getAiStatus, taskAssist } = require('../controllers/ai.controller');

router.use(auth);

router.get('/ai/status', getAiStatus);
router.post('/projects/:id/ai/task-assist', validate(taskAssistSchema), taskAssist);

module.exports = router;
