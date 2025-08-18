const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const {
  loginAdmin,
  verifyToken,
  createAdmin
} = require('../controllers/authController');

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// @route   POST /api/auth/login
// @desc    Admin login
// @access  Public
router.post('/login', loginLimiter, loginAdmin);

// @route   POST /api/auth/verify
// @desc    Verify JWT token
// @access  Public
router.post('/verify', verifyToken);

// @route   POST /api/auth/create-admin
// @desc    Create new admin (for initial setup)
// @access  Public (should be protected in production)
router.post('/create-admin', createAdmin);

module.exports = router;