const express = require('express');
const router = express.Router();
const commentsController = require('../controllers/comments.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Task comments endpoints
router.get('/tasks/:id/comments', commentsController.getTaskComments);
router.post('/tasks/:id/comments', validate(commentsController.createCommentSchema), commentsController.createComment);

// Individual comment endpoints
router.patch('/comments/:id', validate(commentsController.updateCommentSchema), commentsController.updateComment);
router.delete('/comments/:id', commentsController.deleteComment);

module.exports = router;
