const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  submitApplication,
  getApplicationById,
  downloadPublicationDocument,
  getAllApplications,
  updateApplicationStatus,
  getApplicationStats,
  deleteApplication,
  getApplicationsWithPublications,
  cleanupOrphanedFiles
} = require('../controllers/applicationController');

const { 
  authMiddleware,
  adminAuth,
  validateFormAccess,
  checkApplicationOwnership,
  logUserActivity
} = require('../middleware/authMiddleware');

// Rate limiters
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 form submissions per 15 minutes
  message: {
    success: false,
    error: 'Too many form submissions, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const getLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 GET requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 downloads per 15 minutes
  message: {
    success: false,
    error: 'Too many download requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for admin operations
  message: {
    success: false,
    error: 'Too many admin requests, please try again later.',
    retryAfter: '15 minutes'
  }
});

// Input validation middleware for status updates
const validateStatusUpdate = (req, res, next) => {
  const { status, remarks } = req.body;
  const errors = [];

  // Status validation
  const validStatuses = ['submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'interview_scheduled', 'on_hold'];
  if (!status) {
    errors.push({ field: 'status', message: 'Status is required' });
  } else if (!validStatuses.includes(status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  // Remarks validation (optional but recommended for certain statuses)
  if (remarks !== undefined) {
    if (typeof remarks !== 'string') {
      errors.push({ field: 'remarks', message: 'Remarks must be a string' });
    } else if (remarks.length > 1000) {
      errors.push({ field: 'remarks', message: 'Remarks cannot exceed 1000 characters' });
    }
  }

  // Require remarks for rejection
  if (status === 'rejected' && (!remarks || remarks.trim().length === 0)) {
    errors.push({ field: 'remarks', message: 'Remarks are required when rejecting an application' });
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

// Public Routes (Form submission and viewing)

// @route   POST /api/applications/form/:userId
// @desc    Submit new application to a specific user's form
// @access  Public
router.post('/form/:userId', 
  submitLimiter,
  validateFormAccess,
  logUserActivity('Application Submission'),
  submitApplication
);

// @route   GET /api/applications/form/:userId/config
// @desc    Get form configuration for public form
// @access  Public
router.get('/form/:userId/config',
  getLimiter,
  validateFormAccess,
  logUserActivity('Get Form Config'),
  async (req, res) => {
    try {
      const formOwner = req.formOwner;
      
      res.status(200).json({
        success: true,
        formConfig: {
          title: formOwner.formConfig.title || 'Application Form',
          description: formOwner.formConfig.description || 'Please fill out this application form completely.',
          customHeadings: formOwner.formConfig.customHeadings || [],
          ownerInfo: {
            name: formOwner.getFullName(),
            organization: formOwner.organization || ''
          },
          advertisement: formOwner.formConfig.advertisement || null,
          isActive: formOwner.formConfig.isActive
        }
      });
      
    } catch (error) {
      console.error('[APP] Get form config error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   GET /api/applications/form/:userId/advertisement
// @desc    Download form advertisement file
// @access  Public
router.get('/form/:userId/advertisement',
  downloadLimiter,
  validateFormAccess,
  logUserActivity('Download Advertisement'),
  async (req, res) => {
    try {
      const formOwner = req.formOwner;
      
      if (!formOwner.formConfig.advertisement || !formOwner.formConfig.advertisement.path) {
        return res.status(404).json({
          success: false,
          message: 'Advertisement file not found',
          code: 'FILE_NOT_FOUND'
        });
      }

      const filePath = formOwner.formConfig.advertisement.path;
      const fileName = formOwner.formConfig.advertisement.originalName;

      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Content-Type', formOwner.formConfig.advertisement.mimeType);
      
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error('[APP] Advertisement download error:', err);
          if (!res.headersSent) {
            res.status(404).json({
              success: false,
              message: 'File not found',
              code: 'FILE_NOT_FOUND'
            });
          }
        }
      });
    } catch (error) {
      console.error('[APP] Advertisement download error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   GET /api/applications/:applicationId
// @desc    Get application by ID (public for applicant verification)
// @access  Public
router.get('/:applicationId', 
  getLimiter,
  logUserActivity('Get Application by ID'),
  getApplicationById
);

// Private Routes (User-specific application management)

// @route   GET /api/applications/user/list
// @desc    Get applications for authenticated user's forms
// @access  Private
router.get('/user/list', 
  getLimiter,
  authMiddleware,
  logUserActivity('Get User Applications'),
  getAllApplications
);

// @route   GET /api/applications/user/stats
// @desc    Get application statistics for authenticated user
// @access  Private
router.get('/user/stats', 
  getLimiter,
  authMiddleware,
  logUserActivity('Get User Application Stats'),
  getApplicationStats
);

// @route   GET /api/applications/user/with-publications
// @desc    Get applications with publications for authenticated user
// @access  Private
router.get('/user/with-publications', 
  getLimiter,
  authMiddleware,
  logUserActivity('Get Applications with Publications'),
  getApplicationsWithPublications
);

// @route   PUT /api/applications/:applicationId/status
// @desc    Update application status (user must own the form)
// @access  Private
router.put('/:applicationId/status', 
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  validateStatusUpdate,
  logUserActivity('Update Application Status'),
  updateApplicationStatus
);

// @route   PUT /api/applications/:applicationId/priority
// @desc    Update application priority
// @access  Private
router.put('/:applicationId/priority',
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Update Application Priority'),
  async (req, res) => {
    try {
      const { priority } = req.body;
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      
      if (!priority || !validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Priority must be one of: ${validPriorities.join(', ')}`,
          code: 'INVALID_PRIORITY'
        });
      }

      const application = req.application;
      application.priority = priority;
      
      application.interactions.push({
        type: 'note_added',
        details: `Priority changed to ${priority}`,
        performedBy: req.user.id
      });
      
      await application.save();

      res.status(200).json({
        success: true,
        message: 'Application priority updated successfully',
        application: {
          applicationId: application.applicationId,
          priority: application.priority
        }
      });
    } catch (error) {
      console.error('[APP] Update priority error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   PUT /api/applications/:applicationId/tags
// @desc    Update application tags
// @access  Private
router.put('/:applicationId/tags',
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Update Application Tags'),
  async (req, res) => {
    try {
      const { tags } = req.body;
      
      if (!Array.isArray(tags)) {
        return res.status(400).json({
          success: false,
          message: 'Tags must be an array',
          code: 'INVALID_TAGS'
        });
      }

      // Validate tags
      const validTags = tags.filter(tag => 
        typeof tag === 'string' && 
        tag.trim().length > 0 && 
        tag.length <= 50
      );

      if (validTags.length !== tags.length) {
        return res.status(400).json({
          success: false,
          message: 'All tags must be non-empty strings with max 50 characters',
          code: 'INVALID_TAG_FORMAT'
        });
      }

      const application = req.application;
      application.tags = validTags;
      
      application.interactions.push({
        type: 'note_added',
        details: `Tags updated: ${validTags.join(', ')}`,
        performedBy: req.user.id
      });
      
      await application.save();

      res.status(200).json({
        success: true,
        message: 'Application tags updated successfully',
        application: {
          applicationId: application.applicationId,
          tags: application.tags
        }
      });
    } catch (error) {
      console.error('[APP] Update tags error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   POST /api/applications/:applicationId/schedule-interview
// @desc    Schedule interview for application
// @access  Private
router.post('/:applicationId/schedule-interview',
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Schedule Interview'),
  async (req, res) => {
    try {
      const { date, time, location, type, notes, conductedBy } = req.body;
      const errors = [];

      if (!date) errors.push({ field: 'date', message: 'Interview date is required' });
      if (!time) errors.push({ field: 'time', message: 'Interview time is required' });
      if (!type || !['in_person', 'video_call', 'phone_call'].includes(type)) {
        errors.push({ field: 'type', message: 'Interview type must be in_person, video_call, or phone_call' });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      const application = req.application;
      
      await application.scheduleInterview({
        date: new Date(date),
        time,
        location: location || '',
        type,
        notes: notes || '',
        conductedBy: conductedBy || req.user.firstName + ' ' + req.user.lastName
      }, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Interview scheduled successfully',
        interview: application.interview
      });
    } catch (error) {
      console.error('[APP] Schedule interview error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   PUT /api/applications/:applicationId/rating
// @desc    Add/update application rating
// @access  Private
router.put('/:applicationId/rating',
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Update Application Rating'),
  async (req, res) => {
    try {
      const { overall, technical, communication, experience, notes } = req.body;
      const errors = [];

      // Validate ratings (0-10)
      const ratings = { overall, technical, communication, experience };
      Object.keys(ratings).forEach(key => {
        const value = ratings[key];
        if (value !== undefined && value !== null) {
          if (typeof value !== 'number' || value < 0 || value > 10) {
            errors.push({ field: key, message: `${key} rating must be a number between 0 and 10` });
          }
        }
      });

      if (notes !== undefined && (typeof notes !== 'string' || notes.length > 500)) {
        errors.push({ field: 'notes', message: 'Notes must be a string with max 500 characters' });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          code: 'VALIDATION_ERROR'
        });
      }

      const application = req.application;
      
      application.addRating({
        overall,
        technical,
        communication,
        experience,
        notes: notes || ''
      }, req.user.id);
      
      await application.save();

      res.status(200).json({
        success: true,
        message: 'Application rating updated successfully',
        rating: application.rating
      });
    } catch (error) {
      console.error('[APP] Update rating error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   GET /api/applications/:applicationId/publication-document
// @desc    Download publication document (user must own the form)
// @access  Private
router.get('/:applicationId/publication-document', 
  downloadLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Download Publication Document'),
  downloadPublicationDocument
);

// @route   DELETE /api/applications/:applicationId
// @desc    Delete application (user must own the form)
// @access  Private
router.delete('/:applicationId', 
  getLimiter,
  authMiddleware,
  checkApplicationOwnership,
  logUserActivity('Delete Application'),
  deleteApplication
);

// Admin Routes (Super admin access for system management)

// @route   GET /api/applications/admin/all-stats
// @desc    Get system-wide application statistics
// @access  Admin
router.get('/admin/all-stats', 
  adminLimiter,
  adminAuth,
  logUserActivity('Get Admin Stats'),
  async (req, res) => {
    try {
      const Application = require('../models/Application');
      const User = require('../models/User');
      
      const totalApplications = await Application.countDocuments();
      const totalUsers = await User.countDocuments({ isActive: true });
      
      const statusStats = await Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const userStats = await Application.aggregate([
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      res.status(200).json({
        success: true,
        stats: {
          totalApplications,
          totalUsers,
          statusDistribution: statusStats,
          topUsers: userStats
        }
      });
    } catch (error) {
      console.error('[APP] Admin stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
);

// @route   POST /api/applications/admin/cleanup-files
// @desc    Clean up orphaned publication files
// @access  Admin
router.post('/admin/cleanup-files', 
  adminLimiter,
  adminAuth,
  logUserActivity('Cleanup Orphaned Files'),
  cleanupOrphanedFiles
);

// Error handling middleware specific to application routes
router.use((err, req, res, next) => {
  console.error('[APPLICATION ROUTES] Error:', err);
  
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
  
  // Handle file system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'File not found',
      code: 'FILE_NOT_FOUND'
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