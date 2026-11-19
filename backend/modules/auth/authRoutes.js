const express = require('express');
const router = express.Router();
const authController = require('./authController');

router.post('/register', authController.registerStudent);
router.get('/verify', authController.verifyEmail);
router.post('/login', authController.loginStudent);
router.post('/logout', authController.logoutUser);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;