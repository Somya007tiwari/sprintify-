const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticateToken = require('../middleware/auth');

router.post('/signup', validate(authController.signupSchema), authController.signup);
router.post('/login', validate(authController.loginSchema), authController.login);
router.get('/me', authenticateToken, authController.me);

module.exports = router;
