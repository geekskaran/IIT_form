const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  registerUser, 
  loginUser, 
  getUserProfile, 
  updateUserProfile,
  updateFormConfig, 
  uploadAdvertisement,
  deleteAdvertisement,
  getUserApplications,
  getDashboardStats,
  changePassword
} = require('../controllers/userController');

const { 
  authMiddleware, 
  authRateLimit,
  logUserActivity 
} = require('../middleware/authMiddleware');

// Rate limiters for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for general endpoints
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit file uploads per hour
  message: {
    success: false,
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation middleware
const validateRegistration = (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;
  const errors = [];

  // Username validation
  if (!username || typeof username !== 'string') {
    errors.push({ field: 'username', message: 'Username is required' });
  } else if (username.length < 3 || username.length > 50) {
    errors.push({ field: 'username', message: 'Username must be between 3 and 50 characters' });
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push({ field: 'username', message: 'Username can only contain letters, numbers, and underscores' });
  }

  // Email validation
  if (!email || typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }

  // Password validation
  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
  } else if (password.length > 100) {
    errors.push({ field: 'password', message: 'Password cannot exceed 100 characters' });
  }

  // First name validation
  if (!firstName || typeof firstName !== 'string') {
    errors.push({ field: 'firstName', message: 'First name is required' });
  } else if (firstName.length > 50) {
    errors.push({ field: 'firstName', message: 'First name cannot exceed 50 characters' });
  }

  // Last name validation
  if (!lastName || typeof lastName !== 'string') {
    errors.push({ field: 'lastName', message: 'Last name is required' });
  } else if (lastName.length > 50) {
    errors.push({ field: 'lastName', message: 'Last name cannot exceed 50 characters' });
  }

  // Organization validation (optional)
  if (req.body.organization && typeof req.body.organization === 'string' && req.body.organization.length > 100) {
    errors.push({ field: 'organization', message: 'Organization name cannot exceed 100 characters' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address' });
  }

  if (!password || typeof password !== 'string') {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  next();
};

const validateFormConfig = (req, res, next) => {
  const { title, description, customHeadings } = req.body;
  const errors = [];

  if (title !== undefined) {
    if (typeof title !== 'string') {
      errors.push({ field: 'title', message: 'Title must be a string' });
    } else if (title.length > 100) {
      errors.push({ field: 'title', message: 'Title cannot exceed 100 characters' });
    }
  }

  if (description !== undefined) {
    if (typeof description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    } else if (description.length > 500) {
      errors.push({ field: 'description', message: 'Description cannot exceed 500 characters' });
    }
  }

  if (customHeadings !== undefined) {
    if (!Array.isArray(customHeadings)) {
      errors.push({ field: 'customHeadings', message: 'Custom headings must be an array' });
    } else {
      customHeadings.forEach((heading, index) => {
        if (typeof heading.text !== 'string' || heading.text.length > 200) {
          errors.push({ field: `customHeadings[${index}].text`, message: 'Heading text cannot exceed 200 characters' });
        }
        if (heading.position && !['top', 'middle', 'bottom'].includes(heading.position)) {
          errors.push({ field: `customHeadings[${index}].position`, message: 'Invalid heading position' });
        }
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR'
    });
  }

  next();
};

// Public routes (no authentication required)

// @route   POST /api/users/register
// @desc    Register new user
// @access  Public
router.post('/register', 
  authLimiter,
  validateRegistration,
  logUserActivity('User Registration Attempt'),
  registerUser
);

// @route   POST /api/users/login
// @desc    Login user
// @access  Public
router.post('/login', 
  authLimiter,
  validateLogin,
  logUserActivity('User Login Attempt'),
  loginUser
);

// Protected routes (authentication required)

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', 
  generalLimiter,
  authMiddleware,
  logUserActivity('Get Profile'),
  getUserProfile
);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', 
  generalLimiter,
  authMiddleware,
  logUserActivity('Update Profile'),
  updateUserProfile
);

// @route   PUT /api/users/form-config
// @desc    Update form configuration
// @access  Private
router.put('/form-config', 
  generalLimiter,
  authMiddleware,
  validateFormConfig,
  logUserActivity('Update Form Config'),
  updateFormConfig
);

// @route   POST /api/users/upload-advertisement
// @desc    Upload advertisement file
// @access  Private
router.post('/upload-advertisement', 
  uploadLimiter,
  authMiddleware,
  logUserActivity('Upload Advertisement'),
  uploadAdvertisement
);

// @route   DELETE /api/users/advertisement
// @desc    Delete advertisement file
// @access  Private
router.delete('/advertisement', 
  generalLimiter,
  authMiddleware,
  logUserActivity('Delete Advertisement'),
  deleteAdvertisement
);

// @route   GET /api/users/applications
// @desc    Get user's applications with filtering and pagination
// @access  Private
router.get('/applications', 
  generalLimiter,
  authMiddleware,
  logUserActivity('Get Applications'),
  getUserApplications
);

// @route   GET /api/users/dashboard-stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard-stats', 
  generalLimiter,
  authMiddleware,
  logUserActivity('Get Dashboard Stats'),
  getDashboardStats
);

// @route   PUT /api/users/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', 
  authLimiter,
  authMiddleware,
  logUserActivity('Change Password'),
  changePassword
);

// Error handling middleware specific to user routes
router.use((err, req, res, next) => {
  console.error('[USER ROUTES] Error:', err);
  
  // Handle multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected field name for file upload.',
      code: 'UNEXPECTED_FIELD'
    });
  }
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format',
      code: 'INVALID_JSON'
    });
  }
  
  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

module.exports = router;