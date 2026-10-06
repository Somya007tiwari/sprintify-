const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasks.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

// Project task endpoints
router.get('/projects/:id/tasks', tasksController.getProjectTasks);
router.post('/projects/:id/tasks', validate(tasksController.createTaskSchema), tasksController.createTask);

// Individual task endpoints
router.patch('/tasks/:id', validate(tasksController.updateTaskSchema), tasksController.updateTask);
router.patch('/tasks/:id/move', validate(tasksController.moveTaskSchema), tasksController.moveTask);
router.delete('/tasks/:id', tasksController.deleteTask);
router.get('/tasks/:id/activity', tasksController.getTaskActivity);

module.exports = router;
