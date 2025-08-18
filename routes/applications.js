// routes/applications.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// Import controllers and middleware
const {
  submitApplication,
  getApplicationById,
  downloadPublicationDocument,
  getAllApplications,
  updateApplicationStatus,
  getApplicationStats,
  getApplicationsWithPublications,
  deleteApplication,
  cleanupOrphanedFiles
} = require('../controllers/applicationController');

const {
  validateApplicationSubmission,
  validateStatusUpdate,
  validateEducationalQualifications,
  validateExperience,
  validateFileUpload
} = require('../middleware/validation');

// Rate limiting for form submissions
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 submissions per hour
  message: {
    success: false,
    error: 'Too many form submissions, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for getting applications
const getLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Rate limiting for file downloads
const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 downloads per 15 minutes
  message: {
    success: false,
    error: 'Too many download requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Public Routes

// @route   POST /api/applications
// @desc    Submit new application (with file upload support)
// @access  Public
// Note: Validation is handled inside the controller for FormData
router.post('/', 
  submitLimiter,
  submitApplication
);

// @route   GET /api/applications/:applicationId
// @desc    Get application by ID
// @access  Public
router.get('/:applicationId', 
  getLimiter,
  getApplicationById
);

// Admin Routes (Add authentication middleware in production)

// @route   GET /api/applications/admin/stats
// @desc    Get application statistics
// @access  Private (Admin)
router.get('/admin/stats', 
  getLimiter,
  // authMiddleware, // Add authentication middleware
  // adminMiddleware, // Add admin authorization middleware
  getApplicationStats
);

// @route   GET /api/applications/admin/with-publications
// @desc    Get applications that have publication documents
// @access  Private (Admin)
router.get('/admin/with-publications', 
  getLimiter,
  // authMiddleware,
  // adminMiddleware,
  getApplicationsWithPublications
);

// @route   POST /api/applications/admin/cleanup-files
// @desc    Clean up orphaned publication files
// @access  Private (Admin)
router.post('/admin/cleanup-files', 
  // authMiddleware,
  // adminMiddleware,
  cleanupOrphanedFiles
);

// @route   GET /api/applications/:applicationId/publication-document
// @desc    Download publication document
// @access  Private (Admin)
router.get('/:applicationId/publication-document', 
  downloadLimiter,
  // authMiddleware,
  // adminMiddleware,
  downloadPublicationDocument
);

// @route   GET /api/applications
// @desc    Get all applications with pagination
// @access  Private (Admin)
router.get('/', 
  getLimiter,
  // authMiddleware, // Add authentication middleware
  // adminMiddleware, // Add admin authorization middleware
  getAllApplications
);

// @route   PUT /api/applications/:applicationId/status
// @desc    Update application status
// @access  Private (Admin)
router.put('/:applicationId/status', 
  // authMiddleware,
  // adminMiddleware,
  validateStatusUpdate,
  updateApplicationStatus
);

// @route   DELETE /api/applications/:applicationId
// @desc    Delete application (and associated files)
// @access  Private (Admin)
router.delete('/:applicationId', 
  // authMiddleware,
  // adminMiddleware,
  deleteApplication
);

module.exports = router;