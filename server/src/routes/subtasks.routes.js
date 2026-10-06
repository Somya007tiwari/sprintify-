const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  createSubtaskSchema,
  bulkCreateSubtaskSchema,
  updateSubtaskSchema,
  getTaskSubtasks,
  createSubtask,
  bulkCreateSubtasks,
  updateSubtask,
  deleteSubtask,
} = require('../controllers/subtasks.controller');

router.use(auth);

router.get('/tasks/:id/subtasks', getTaskSubtasks);
router.post('/tasks/:id/subtasks', validate(createSubtaskSchema), createSubtask);
router.post('/tasks/:id/subtasks/bulk', validate(bulkCreateSubtaskSchema), bulkCreateSubtasks);
router.patch('/subtasks/:id', validate(updateSubtaskSchema), updateSubtask);
router.delete('/subtasks/:id', deleteSubtask);

module.exports = router;
