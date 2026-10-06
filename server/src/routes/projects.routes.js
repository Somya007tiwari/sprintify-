const express = require('express');
const router = express.Router();
const projectsController = require('../controllers/projects.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', projectsController.getProjects);
router.post('/', validate(projectsController.createProjectSchema), projectsController.createProject);
router.get('/:id', projectsController.getProjectById);
router.post('/:id/members', validate(projectsController.addMemberSchema), projectsController.addProjectMember);

module.exports = router;
