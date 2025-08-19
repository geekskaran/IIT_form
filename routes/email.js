const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { 
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  sendBulkEmails,
  previewTemplate,
  getEmailHistory
} = require('../controllers/emailController');

const { 
  authMiddleware, 
  checkTemplateOwnership,
  logUserActivity 
} = require('../middleware/authMiddleware');

// Rate limiters for different endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit bulk email sending per hour
  message: {
    success: false,
    error: 'Too many bulk email requests, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const templateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit template creation/updates
  message: {
    success: false,
    error: 'Too many template operations, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Input validation middleware
const validateTemplateData = (req, res, next) => {
  const { name, subject, body, variables, category } = req.body;
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string') {
    errors.push({ field: 'name', message: 'Template name is required' });
  } else if (name.length < 1 || name.length > 100) {
    errors.push({ field: 'name', message: 'Template name must be between 1 and 100 characters' });
  }

  // Subject validation
  if (!subject || typeof subject !== 'string') {
    errors.push({ field: 'subject', message: 'Email subject is required' });
  } else if (subject.length < 1 || subject.length > 200) {
    errors.push({ field: 'subject', message: 'Subject must be between 1 and 200 characters' });
  }

  // Body validation
  if (!body || typeof body !== 'string') {
    errors.push({ field: 'body', message: 'Email body is required' });
  } else if (body.length < 1 || body.length > 10000) {
    errors.push({ field: 'body', message: 'Email body must be between 1 and 10000 characters' });
  }

  // Variables validation (optional)
  if (variables !== undefined) {
    if (!Array.isArray(variables)) {
      errors.push({ field: 'variables', message: 'Variables must be an array' });
    } else {
      variables.forEach((variable, index) => {
        if (!variable.name || typeof variable.name !== 'string') {
          errors.push({ field: `variables[${index}].name`, message: 'Variable name is required' });
        }
        if (variable.description !== undefined && typeof variable.description !== 'string') {
          errors.push({ field: `variables[${index}].description`, message: 'Variable description must be a string' });
        }
      });
    }
  }

  // Category validation (optional)
  if (category !== undefined) {
    const validCategories = ['approval', 'rejection', 'shortlist', 'interview', 'follow_up', 'general'];
    if (!validCategories.includes(category)) {
      errors.push({ field: 'category', message: `Category must be one of: ${validCategories.join(', ')}` });
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

const validateBulkEmailData = (req, res, next) => {
  const { templateId, applicationIds, customVariables } = req.body;
  const errors = [];

  // Template ID validation
  if (!templateId || typeof templateId !== 'string') {
    errors.push({ field: 'templateId', message: 'Template ID is required' });
  }

  // Application IDs validation
  if (!applicationIds || !Array.isArray(applicationIds)) {
    errors.push({ field: 'applicationIds', message: 'Application IDs must be an array' });
  } else if (applicationIds.length === 0) {
    errors.push({ field: 'applicationIds', message: 'At least one application ID is required' });
  } else if (applicationIds.length > 100) {
    errors.push({ field: 'applicationIds', message: 'Cannot send to more than 100 applications at once' });
  } else {
    applicationIds.forEach((id, index) => {
      if (typeof id !== 'string') {
        errors.push({ field: `applicationIds[${index}]`, message: 'Application ID must be a string' });
      }
    });
  }

  // Custom variables validation (optional)
  if (customVariables !== undefined && typeof customVariables !== 'object') {
    errors.push({ field: 'customVariables', message: 'Custom variables must be an object' });
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

// All email routes require authentication
router.use(authMiddleware);

// Template Management Routes

// @route   POST /api/email/templates
// @desc    Create new email template
// @access  Private
router.post('/templates', 
  templateLimiter,
  validateTemplateData,
  logUserActivity('Create Email Template'),
  createTemplate
);

// @route   GET /api/email/templates
// @desc    Get user's email templates
// @access  Private
router.get('/templates', 
  generalLimiter,
  logUserActivity('Get Email Templates'),
  getTemplates
);

// @route   GET /api/email/templates/:templateId
// @desc    Get single email template
// @access  Private
router.get('/templates/:templateId', 
  generalLimiter,
  checkTemplateOwnership,
  logUserActivity('Get Single Email Template'),
  getTemplate
);

// @route   PUT /api/email/templates/:templateId
// @desc    Update email template
// @access  Private
router.put('/templates/:templateId', 
  templateLimiter,
  checkTemplateOwnership,
  validateTemplateData,
  logUserActivity('Update Email Template'),
  updateTemplate
);

// @route   DELETE /api/email/templates/:templateId
// @desc    Delete email template
// @access  Private
router.delete('/templates/:templateId', 
  generalLimiter,
  checkTemplateOwnership,
  logUserActivity('Delete Email Template'),
  deleteTemplate
);

// @route   POST /api/email/templates/:templateId/duplicate
// @desc    Duplicate email template
// @access  Private
router.post('/templates/:templateId/duplicate', 
  templateLimiter,
  checkTemplateOwnership,
  logUserActivity('Duplicate Email Template'),
  duplicateTemplate
);

// @route   POST /api/email/templates/:templateId/preview
// @desc    Preview email template with sample data
// @access  Private
router.post('/templates/:templateId/preview', 
  generalLimiter,
  checkTemplateOwnership,
  logUserActivity('Preview Email Template'),
  previewTemplate
);

// Email Sending Routes

// @route   POST /api/email/send-bulk
// @desc    Send bulk emails using template
// @access  Private
router.post('/send-bulk', 
  emailSendLimiter,
  validateBulkEmailData,
  logUserActivity('Send Bulk Emails'),
  sendBulkEmails
);

// Email History Routes

// @route   GET /api/email/history
// @desc    Get email sending history
// @access  Private
router.get('/history', 
  generalLimiter,
  logUserActivity('Get Email History'),
  getEmailHistory
);

// Utility Routes

// @route   GET /api/email/template-variables
// @desc    Get available template variables
// @access  Private
router.get('/template-variables', 
  generalLimiter,
  logUserActivity('Get Template Variables'),
  (req, res) => {
    const availableVariables = [
      {
        name: 'applicantName',
        description: 'Full name of the applicant',
        example: 'John Doe'
      },
      {
        name: 'applicationId',
        description: 'Unique application ID',
        example: 'RND1234567890123'
      },
      {
        name: 'email',
        description: 'Applicant\'s email address',
        example: 'john.doe@example.com'
      },
      {
        name: 'phone',
        description: 'Applicant\'s phone number',
        example: '9876543210'
      },
      {
        name: 'submissionDate',
        description: 'Date when application was submitted',
        example: '2024-01-15'
      },
      {
        name: 'status',
        description: 'Current application status',
        example: 'under_review'
      },
      {
        name: 'organizationName',
        description: 'Your organization name',
        example: 'IIT Patna'
      },
      {
        name: 'senderName',
        description: 'Your full name',
        example: 'Dr. John Smith'
      },
      {
        name: 'senderEmail',
        description: 'Your email address',
        example: 'john.smith@iitp.ac.in'
      },
      {
        name: 'currentDate',
        description: 'Current date',
        example: '2024-01-20'
      },
      {
        name: 'currentTime',
        description: 'Current time',
        example: '10:30 AM'
      }
    ];

    res.status(200).json({
      success: true,
      variables: availableVariables,
      usage: {
        syntax: '{{variableName}}',
        example: 'Dear {{applicantName}}, your application {{applicationId}} has been received.'
      }
    });
  }
);

// @route   GET /api/email/categories
// @desc    Get available template categories
// @access  Private
router.get('/categories', 
  generalLimiter,
  logUserActivity('Get Template Categories'),
  (req, res) => {
    const categories = [
      {
        value: 'general',
        label: 'General',
        description: 'General purpose templates'
      },
      {
        value: 'approval',
        label: 'Approval',
        description: 'Templates for approved applications'
      },
      {
        value: 'rejection',
        label: 'Rejection',
        description: 'Templates for rejected applications'
      },
      {
        value: 'shortlist',
        label: 'Shortlisted',
        description: 'Templates for shortlisted candidates'
      },
      {
        value: 'interview',
        label: 'Interview',
        description: 'Templates for interview scheduling'
      },
      {
        value: 'follow_up',
        label: 'Follow-up',
        description: 'Templates for follow-up communications'
      }
    ];

    res.status(200).json({
      success: true,
      categories
    });
  }
);

// Error handling middleware specific to email routes
router.use((err, req, res, next) => {
  console.error('[EMAIL ROUTES] Error:', err);
  
  // Handle specific email-related errors
  if (err.code === 'EAUTH' || err.code === 'ECONNECTION') {
    return res.status(500).json({
      success: false,
      message: 'Email service configuration error. Please contact administrator.',
      code: 'EMAIL_SERVICE_ERROR'
    });
  }
  
  if (err.code === 'EMESSAGE') {
    return res.status(400).json({
      success: false,
      message: 'Invalid email message format',
      code: 'INVALID_EMAIL_FORMAT'
    });
  }
  
  // Handle template processing errors
  if (err.message && err.message.includes('template')) {
    return res.status(400).json({
      success: false,
      message: 'Template processing error',
      code: 'TEMPLATE_PROCESSING_ERROR'
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