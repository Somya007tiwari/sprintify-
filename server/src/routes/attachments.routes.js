const express = require('express');
const router = express.Router();
const attachmentsController = require('../controllers/attachments.controller');
const upload = require('../middleware/upload');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Task attachments endpoints
router.get('/tasks/:id/attachments', attachmentsController.getTaskAttachments);
router.post('/tasks/:id/attachments', upload.array('file', 5), attachmentsController.uploadAttachments);

// Download and delete attachment endpoints
router.get('/attachments/:id/download', attachmentsController.downloadAttachment);
router.delete('/attachments/:id', attachmentsController.deleteAttachment);

module.exports = router;
