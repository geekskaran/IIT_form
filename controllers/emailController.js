const EmailTemplate = require('../models/EmailTemplate');
const Application = require('../models/Application');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true' || false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

// @desc    Create email template
// @route   POST /api/email/templates
// @access  Private
const createTemplate = async (req, res) => {
  try {
    const { name, subject, body, variables, category, isDraft } = req.body;

    // Validate required fields
    if (!name || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Template name, subject, and body are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Check if template name already exists for this user
    const existingTemplate = await EmailTemplate.findOne({
      userId: req.user.id,
      name: name.trim(),
      isActive: true
    });

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Template with this name already exists',
        code: 'TEMPLATE_NAME_EXISTS'
      });
    }

    const template = new EmailTemplate({
      userId: req.user.id,
      name: name.trim(),
      subject: subject.trim(),
      body: body.trim(),
      variables: variables || [],
      category: category || 'general',
      isDraft: isDraft || false
    });

    await template.save();

    console.log(`[EMAIL] Template created: ${template.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      template
    });

  } catch (error) {
    console.error('[EMAIL] Create template error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
        code: 'VALIDATION_ERROR'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get user's email templates
// @route   GET /api/email/templates
// @access  Private
const getTemplates = async (req, res) => {
  try {
    const { category, includeDrafts, page = 1, limit = 20 } = req.query;
    
    const options = {
      category: category !== 'all' ? category : undefined,
      includeDrafts: includeDrafts === 'true'
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { userId: req.user.id, isActive: true };
    
    if (options.category) {
      query.category = options.category;
    }
    
    if (!options.includeDrafts) {
      query.isDraft = false;
    }

    const templates = await EmailTemplate.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await EmailTemplate.countDocuments(query);

    // Get category counts
    const categoryStats = await EmailTemplate.aggregate([
      { $match: { userId: req.user.id, isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          drafts: {
            $sum: { $cond: ['$isDraft', 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      templates,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      categoryStats
    });

  } catch (error) {
    console.error('[EMAIL] Get templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get single email template
// @route   GET /api/email/templates/:templateId
// @access  Private
const getTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      template
    });

  } catch (error) {
    console.error('[EMAIL] Get template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Update email template
// @route   PUT /api/email/templates/:templateId
// @access  Private
const updateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { name, subject, body, variables, category, isDraft } = req.body;

    const template = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Check if new name conflicts with existing templates (excluding current)
    if (name && name.trim() !== template.name) {
      const existingTemplate = await EmailTemplate.findOne({
        userId: req.user.id,
        name: name.trim(),
        isActive: true,
        _id: { $ne: template._id }
      });

      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Template with this name already exists',
          code: 'TEMPLATE_NAME_EXISTS'
        });
      }
    }

    // Update fields
    if (name !== undefined) template.name = name.trim();
    if (subject !== undefined) template.subject = subject.trim();
    if (body !== undefined) template.body = body.trim();
    if (variables !== undefined) template.variables = variables;
    if (category !== undefined) template.category = category;
    if (isDraft !== undefined) template.isDraft = isDraft;

    await template.save();

    console.log(`[EMAIL] Template updated: ${template.name} by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      template
    });

  } catch (error) {
    console.error('[EMAIL] Update template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Delete email template
// @route   DELETE /api/email/templates/:templateId
// @access  Private
const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;

    const template = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Soft delete
    template.isActive = false;
    await template.save();

    console.log(`[EMAIL] Template deleted: ${template.name} by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully'
    });

  } catch (error) {
    console.error('[EMAIL] Delete template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Duplicate email template
// @route   POST /api/email/templates/:templateId/duplicate
// @access  Private
const duplicateTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { newName } = req.body;

    const originalTemplate = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    const duplicateName = newName || `${originalTemplate.name} (Copy)`;

    // Check if duplicate name exists
    const existingTemplate = await EmailTemplate.findOne({
      userId: req.user.id,
      name: duplicateName,
      isActive: true
    });

    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Template with this name already exists',
        code: 'TEMPLATE_NAME_EXISTS'
      });
    }

    const newTemplate = new EmailTemplate({
      userId: req.user.id,
      name: duplicateName,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      variables: originalTemplate.variables,
      category: originalTemplate.category,
      isDraft: true // Mark duplicates as drafts by default
    });

    await newTemplate.save();

    console.log(`[EMAIL] Template duplicated: ${originalTemplate.name} -> ${newTemplate.name} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Template duplicated successfully',
      template: newTemplate
    });

  } catch (error) {
    console.error('[EMAIL] Duplicate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Send bulk emails
// @route   POST /api/email/send-bulk
// @access  Private
const sendBulkEmails = async (req, res) => {
  try {
    const { templateId, applicationIds, customVariables = {}, sendOptions = {} } = req.body;

    // Validate required fields
    if (!templateId || !applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Template ID and application IDs are required',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Get template
    const template = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Get applications
    const applications = await Application.find({
      applicationId: { $in: applicationIds },
      userId: req.user.id
    });

    if (applications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid applications found',
        code: 'NO_APPLICATIONS_FOUND'
      });
    }

    // Get user info for email signature
    const user = await User.findById(req.user.id);

    const emailResults = [];
    const transporter = createTransporter();

    // Send emails with delay to avoid rate limiting
    for (let i = 0; i < applications.length; i++) {
      const application = applications[i];
      
      try {
        // Prepare variables for template processing
        const templateVariables = {
          applicantName: application.name,
          applicationId: application.applicationId,
          email: application.email,
          phone: application.phone,
          submissionDate: application.submissionTime.toLocaleDateString(),
          status: application.status,
          organizationName: user.organization || user.getFullName(),
          senderName: user.getFullName(),
          senderEmail: user.email,
          currentDate: new Date().toLocaleDateString(),
          currentTime: new Date().toLocaleTimeString(),
          ...customVariables
        };

        // Process template
        const processedTemplate = template.processTemplate(templateVariables);

        // Email options
        const mailOptions = {
          from: `${user.getFullName()} <${process.env.SMTP_USER}>`,
          to: application.email,
          subject: processedTemplate.subject,
          html: processedTemplate.body,
          replyTo: user.email
        };

        // Add CC/BCC if specified
        if (sendOptions.cc) mailOptions.cc = sendOptions.cc;
        if (sendOptions.bcc) mailOptions.bcc = sendOptions.bcc;

        // Send email
        const info = await transporter.sendMail(mailOptions);

        // Update application with email history
        application.addEmailHistory({
          templateId: template.templateId,
          templateName: template.name,
          subject: processedTemplate.subject,
          sentBy: req.user.id,
          status: 'sent'
        });

        await application.save();

        // Update template usage stats
        await template.incrementUsage();

        emailResults.push({
          applicationId: application.applicationId,
          email: application.email,
          name: application.name,
          status: 'sent',
          messageId: info.messageId,
          sentAt: new Date()
        });

        console.log(`[EMAIL] Sent to ${application.email} using template ${template.name}`);

        // Add delay between emails to avoid rate limiting (1 second)
        if (i < applications.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (emailError) {
        console.error(`[EMAIL] Failed to send to ${application.email}:`, emailError);
        
        // Still update application with failed status
        application.addEmailHistory({
          templateId: template.templateId,
          templateName: template.name,
          subject: template.subject,
          sentBy: req.user.id,
          status: 'failed',
          errorMessage: emailError.message
        });

        await application.save();

        emailResults.push({
          applicationId: application.applicationId,
          email: application.email,
          name: application.name,
          status: 'failed',
          error: emailError.message,
          sentAt: new Date()
        });
      }
    }

    const summary = {
      total: emailResults.length,
      sent: emailResults.filter(r => r.status === 'sent').length,
      failed: emailResults.filter(r => r.status === 'failed').length
    };

    console.log(`[EMAIL] Bulk send completed: ${summary.sent}/${summary.total} sent successfully by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: `Bulk email sending completed. ${summary.sent} sent, ${summary.failed} failed.`,
      results: emailResults,
      summary,
      template: {
        id: template.templateId,
        name: template.name,
        category: template.category
      }
    });

  } catch (error) {
    console.error('[EMAIL] Bulk send error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Preview email template with sample data
// @route   POST /api/email/templates/:templateId/preview
// @access  Private
const previewTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { sampleData = {} } = req.body;

    const template = await EmailTemplate.findOne({
      templateId,
      userId: req.user.id,
      isActive: true
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    // Get user info
    const user = await User.findById(req.user.id);

    // Prepare sample variables
    const sampleVariables = {
      applicantName: 'John Doe',
      applicationId: 'RND1234567890123',
      email: 'john.doe@example.com',
      phone: '9876543210',
      submissionDate: new Date().toLocaleDateString(),
      status: 'submitted',
      organizationName: user.organization || user.getFullName(),
      senderName: user.getFullName(),
      senderEmail: user.email,
      currentDate: new Date().toLocaleDateString(),
      currentTime: new Date().toLocaleTimeString(),
      ...sampleData
    };

    // Process template
    const processedTemplate = template.processTemplate(sampleVariables);

    res.status(200).json({
      success: true,
      preview: {
        subject: processedTemplate.subject,
        body: processedTemplate.body,
        variables: sampleVariables,
        availableVariables: template.getAvailableVariables()
      }
    });

  } catch (error) {
    console.error('[EMAIL] Preview template error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get email sending history
// @route   GET /api/email/history
// @access  Private
const getEmailHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, applicationId, templateId, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build aggregation pipeline
    const pipeline = [
      { $match: { userId: req.user.id } },
      { $unwind: '$emailsSent' },
      {
        $lookup: {
          from: 'emailtemplates',
          localField: 'emailsSent.templateId',
          foreignField: 'templateId',
          as: 'templateInfo'
        }
      },
      {
        $project: {
          applicationId: 1,
          name: 1,
          email: 1,
          emailData: '$emailsSent',
          templateInfo: { $arrayElemAt: ['$templateInfo', 0] }
        }
      },
      { $sort: { 'emailData.sentAt': -1 } }
    ];

    // Add filters
    const matchStage = pipeline[0].$match;
    if (applicationId) matchStage.applicationId = applicationId;
    if (templateId) matchStage['emailsSent.templateId'] = templateId;
    if (status) matchStage['emailsSent.status'] = status;

    // Get total count
    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await Application.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    // Get paginated results
    const resultsPipeline = [...pipeline, { $skip: skip }, { $limit: parseInt(limit) }];
    const history = await Application.aggregate(resultsPipeline);

    res.status(200).json({
      success: true,
      history,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[EMAIL] Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  sendBulkEmails,
  previewTemplate,
  getEmailHistory
};