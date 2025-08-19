



const Application = require('../models/Application');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// CRITICAL: Import the SAME otpStorage from otpController
const { otpStorage } = require('./otpController');

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'publications');

    try {
      await fs.access(uploadDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'publication-' + uniqueSuffix + extension);
  }
});

// File filter for PDF only
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Upload middleware
const uploadMiddleware = upload.single('publicationDocument');

// Send confirmation email
const sendConfirmationEmail = async (applicationData) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@iitp.ac.in',
      to: applicationData.email,
      subject: `Application Received - ${applicationData.applicationId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h2 style="color: #333;">IIT Patna</h2>
            <p style="color: #666;">Application Confirmation</p>
          </div>
          <div style="padding: 20px; background-color: white;">
            <p>Dear ${applicationData.name},</p>
            <p>Thank you for submitting your application to IIT Patna</p>
            <div style="background-color: #e9ecef; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
              <strong>Application Details:</strong><br>
              Application ID: ${applicationData.applicationId}<br>
              Name: ${applicationData.name}<br>
              Category: ${applicationData.category}<br>
              Submission Date: ${new Date(applicationData.submissionTime).toLocaleDateString()}<br>
              ${applicationData.publicationDocument?.filename ? 'Publication Document: Uploaded<br>' : ''}
              ${applicationData.publicationDetails ? 'Publications Provided: Yes<br>' : ''}
            </div>
            <p>Your application is currently under review. We will contact you if any additional information is required.</p>
            <p style="margin-top: 30px;">Best regards,<br>
            <strong>PI</strong><br>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            This is an automated email. Please do not reply to this email.
          </div>
        </div>
      `,
    };

    // Send confirmation email (Always send, regardless of environment)
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[APP] Confirmation email sent successfully to: ${applicationData.email}`);
    } catch (emailError) {
      console.error(`[APP] Failed to send confirmation email to ${applicationData.email}:`, emailError);
      // Don't throw error - email failure shouldn't stop application submission
    }
    console.log(`[APP] Confirmation email sent to ${applicationData.email}`);
  } catch (error) {
    console.error('[APP] Error sending confirmation email:', error);
    // Don't throw error - email failure shouldn't stop application submission
  }
};

// Helper function to safely delete uploaded file
const deleteUploadedFile = async (filePath) => {
  try {
    if (filePath) {
      await fs.unlink(filePath);
      console.log(`[APP] Deleted uploaded file: ${filePath}`);
    }
  } catch (error) {
    console.error('[APP] Error deleting uploaded file:', error);
  }
};

// @desc    Download template document
// @route   GET /api/download-template
// @access  Public
const downloadTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'JRF_Application_Template.docx');

    // Check if template file exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Template file not found. Please contact administrator.'
      });
    }

    // Set appropriate headers for DOCX download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="JRF_Application_Template.docx"');

    // Stream the file
    res.sendFile(path.resolve(templatePath));

  } catch (error) {
    console.error('[APP] Error downloading template:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Submit new application
// @route   POST /api/applications
// @access  Public
// const submitApplication = async (req, res) => {
//   uploadMiddleware(req, res, async (err) => {
//     let uploadedFilePath = null;

//     try {
//       // Handle multer errors
//       if (err) {
//         if (err instanceof multer.MulterError) {
//           if (err.code === 'LIMIT_FILE_SIZE') {
//             return res.status(400).json({
//               success: false,
//               message: 'File too large',
//               errors: [{
//                 field: 'publicationDocument',
//                 message: 'File size must be less than 5MB'
//               }]
//             });
//           }
//         }
//         return res.status(400).json({
//           success: false,
//           message: 'File upload error',
//           errors: [{
//             field: 'publicationDocument',
//             message: err.message || 'File upload failed'
//           }]
//         });
//       }

//       // Store file path for potential cleanup
//       if (req.file) {
//         uploadedFilePath = req.file.path;
//       }

//       // Parse JSON fields from FormData
//       try {
//         if (req.body.educationalQualifications) {
//           if (typeof req.body.educationalQualifications === 'string') {
//             req.body.educationalQualifications = JSON.parse(req.body.educationalQualifications);
//           }
//         }
//         if (req.body.experience) {
//           if (typeof req.body.experience === 'string') {
//             req.body.experience = JSON.parse(req.body.experience);
//           }
//         }
//       } catch (parseError) {
//         console.error('[APP] JSON parse error:', parseError);
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid JSON data in form fields',
//           errors: [{
//             field: 'general',
//             message: 'Failed to parse educational qualifications or experience data'
//           }]
//         });
//       }

//       // Log received data for debugging
//       console.log('[APP] Received form data:');
//       console.log('[APP] Email from form:', req.body.email);
//       console.log('[APP] Declaration agreed:', req.body.declarationAgreed);
//       console.log('[APP] Educational qualifications:', req.body.educationalQualifications);
//       console.log('[APP] Experience:', req.body.experience);

//       // Normalize email for verification check
//       const normalizedEmail = req.body.email.toLowerCase().trim();
//       const verificationKey = `${normalizedEmail}_verified`;

//       console.log('[APP] Checking email verification...');
//       console.log('[APP] Normalized email:', normalizedEmail);
//       console.log('[APP] Verification key:', verificationKey);
//       console.log('[APP] All OTP storage keys:', Array.from(otpStorage.keys()));

//       const isEmailVerified = otpStorage.get(verificationKey) || false;
//       console.log('[APP] Email verification status:', isEmailVerified);

//       if (!isEmailVerified) {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         console.log('[APP] Email verification failed - returning error');
//         return res.status(400).json({
//           success: false,
//           message: 'Email verification required',
//           errors: [{
//             field: 'email',
//             message: 'Please verify your email address before submitting the application'
//           }]
//         });
//       }

//       console.log('[APP] Email verification passed - proceeding with submission');

//       // Check declaration agreement
//       if (!req.body.declarationAgreed || req.body.declarationAgreed !== 'true') {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(400).json({
//           success: false,
//           message: 'Declaration agreement required',
//           errors: [{
//             field: 'declarationAgreed',
//             message: 'You must agree to the declaration to proceed'
//           }]
//         });
//       }

//       // Extract client IP address
//       const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

//       // Check for duplicate email submissions in last 24 hours
//       const existingApplication = await Application.findOne({
//         email: normalizedEmail,
//         submissionTime: {
//           $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
//         }
//       });

//       if (existingApplication) {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(409).json({
//           success: false,
//           message: 'An application with this email was already submitted in the last 24 hours',
//           applicationId: existingApplication.applicationId
//         });
//       }

//       // Prepare application data
//       const applicationData = {
//         ...req.body,
//         email: normalizedEmail, // Use normalized email
//         declarationAgreed: true, // Set as boolean
//         ipAddress,
//         submissionTime: new Date()
//       };

//       // Remove emailVerified field from data before saving
//       delete applicationData.emailVerified;

//       // Handle file upload data
//       if (req.file) {
//         applicationData.publicationDocument = {
//           filename: req.file.filename,
//           originalName: req.file.originalname,
//           size: req.file.size,
//           mimeType: req.file.mimetype,
//           uploadDate: new Date(),
//           path: req.file.path
//         };
//       }

//       // Validate publication document is required
//       if (!req.file) {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(400).json({
//           success: false,
//           message: 'Publication document is required',
//           errors: [{
//             field: 'publicationDocument',
//             message: 'Publication document upload is mandatory'
//           }]
//         });
//       }

//       // Validate educational qualifications array
//       if (!applicationData.educationalQualifications ||
//         !Array.isArray(applicationData.educationalQualifications) ||
//         applicationData.educationalQualifications.length === 0) {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(400).json({
//           success: false,
//           message: 'At least one educational qualification is required',
//           errors: [{
//             field: 'educationalQualifications',
//             message: 'At least one educational qualification is required'
//           }]
//         });
//       }

//       // Validate experience array
//       if (!applicationData.experience ||
//         !Array.isArray(applicationData.experience) ||
//         applicationData.experience.length === 0) {
//         if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//         return res.status(400).json({
//           success: false,
//           message: 'At least one work experience is required',
//           errors: [{
//             field: 'experience',
//             message: 'At least one work experience is required'
//           }]
//         });
//       }

//       // Validate each educational qualification (Updated with nameOfExamination)
//       for (let i = 0; i < applicationData.educationalQualifications.length; i++) {
//         const qual = applicationData.educationalQualifications[i];
//         const errors = [];

//         if (!qual.institute || !qual.institute.trim()) {
//           errors.push({ field: `educationalQualifications[${i}].institute`, message: 'Institute name is required' });
//         }

//         if (!qual.examPassed) {
//           errors.push({ field: `educationalQualifications[${i}].examPassed`, message: 'Exam passed is required' });
//         }

//         if (!qual.nameOfExamination || !qual.nameOfExamination.trim()) {
//           errors.push({ field: `educationalQualifications[${i}].nameOfExamination`, message: 'Name of examination is required' });
//         }

//         if (!qual.yearOfPassing || !qual.yearOfPassing.toString().trim()) {
//           errors.push({ field: `educationalQualifications[${i}].yearOfPassing`, message: 'Year of passing is required' });
//         }

//         if (!qual.marksPercentage || !qual.marksPercentage.trim()) {
//           errors.push({ field: `educationalQualifications[${i}].marksPercentage`, message: 'Marks/Percentage is required' });
//         }

//         if (errors.length > 0) {
//           if (uploadedFilePath) await deleteUploadedFile(uploadedFilePath);
//           return res.status(400).json({
//             success: false,
//             message: 'Educational qualification validation failed',
//             errors
//           });
//         }
//       }

//       // Validate each experience


//       console.log('[APP] All validations passed - creating application');

//       // Create new application
//       const application = new Application(applicationData);
//       await application.save();

//       console.log('[APP] Application saved successfully:', application.applicationId);

//       // Send confirmation email (async, don't wait)
//       sendConfirmationEmail(application);

//       // Clean up verification status ONLY after successful submission
//       otpStorage.delete(verificationKey);
//       console.log('[APP] Cleaned up verification status for:', normalizedEmail);

//       res.status(201).json({
//         success: true,
//         message: 'Application submitted successfully',
//         applicationId: application.applicationId,
//         submissionTime: application.submissionTime,
//         publicationDocument: application.publicationDocument?.filename ? {
//           uploaded: true,
//           filename: application.publicationDocument.originalName,
//           size: application.publicationDocument.size
//         } : null
//       });

//     } catch (error) {
//       console.error('[APP] Application submission error:', error);

//       // Clean up uploaded file on error
//       if (uploadedFilePath) {
//         await deleteUploadedFile(uploadedFilePath);
//       }

//       // Handle specific MongoDB errors
//       if (error.code === 11000) {
//         return res.status(409).json({
//           success: false,
//           message: 'Application with this email already exists'
//         });
//       }

//       if (error.name === 'ValidationError') {
//         const validationErrors = Object.values(error.errors).map(err => ({
//           field: err.path,
//           message: err.message
//         }));

//         return res.status(400).json({
//           success: false,
//           message: 'Validation failed',
//           errors: validationErrors
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: 'Internal server error. Please try again later.'
//       });
//     }
//   });
// };


// @desc    Submit new application
// @route   POST /api/applications/form/:userId
// @access  Public
const submitApplication = async (req, res) => {
  uploadMiddleware(req, res, async (uploadErr) => {
    if (uploadErr) {
      console.error('[APP] Upload error:', uploadErr);
      return res.status(400).json({
        success: false,
        message: uploadErr.message || 'File upload failed',
        code: 'FILE_UPLOAD_ERROR'
      });
    }

    try {
      const formOwner = req.formOwner; // Set by validateFormAccess middleware
      const {
        email,
        name,
        address,
        phone,
        category,
        dob,
        gender,
        professionalExam,
        professionalExamValidity,
        educationalQualifications,
        experience,
        publicationDetails,
        declarationAgreed,
        applicationDate,
        applicationPlace,
        nameDeclaration,
        otherExamName
      } = req.body;

      // Verify OTP
      const normalizedEmail = email.toLowerCase().trim();
      const storedOTPData = otpStorage.get(normalizedEmail);

      if (!storedOTPData || !storedOTPData.verified) {
        return res.status(400).json({
          success: false,
          message: 'Email verification required. Please verify your email first.',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }

      // Parse JSON strings if they come as strings
      let parsedEducation, parsedExperience;
      try {
        parsedEducation = typeof educationalQualifications === 'string'
          ? JSON.parse(educationalQualifications)
          : educationalQualifications;
        parsedExperience = typeof experience === 'string'
          ? JSON.parse(experience)
          : experience;
      } catch (parseError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid education or experience data format',
          code: 'INVALID_DATA_FORMAT'
        });
      }

      // Create application with userId (MULTI-USER SUPPORT)
      const applicationData = {
        userId: formOwner._id, // Link to form owner
        name,
        address,
        phone,
        email: normalizedEmail,
        category,
        dob: new Date(dob),
        gender,
        professionalExam: professionalExam || '',
        professionalExamValidity: professionalExamValidity ? new Date(professionalExamValidity) : null,
        educationalQualifications: parsedEducation || [],
        experience: parsedExperience || [],
        publicationDetails: publicationDetails || '',
        otherExamName: otherExamName || '',
        declarationAgreed: declarationAgreed === true || declarationAgreed === 'true',
        applicationDate: new Date(applicationDate),
        applicationPlace,
        nameDeclaration,
        submissionTime: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        status: 'submitted'
      };

      // Handle file upload
      if (req.file) {
        applicationData.publicationDocument = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          uploadDate: new Date(),
          path: req.file.path
        };
      }

      const application = new Application(applicationData);
      await application.save();

      // Update user statistics
      await formOwner.updateStats();

      // Clear OTP after successful submission
      otpStorage.delete(normalizedEmail);

      // Send confirmation email
      try {
        await sendConfirmationEmail(application, formOwner);
      } catch (emailError) {
        console.error('[APP] Confirmation email failed:', emailError);
      }

      console.log(`[APP] Application submitted: ${application.applicationId} to ${formOwner.username}`);

      res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        applicationId: application.applicationId,
        submissionTime: application.submissionTime
      });

    } catch (error) {
      console.error('[APP] Submit application error:', error);

      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('[APP] File cleanup error:', cleanupError);
        }
      }

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
  });
};




// @desc    Get application by ID
// @route   GET /api/applications/:applicationId
// @access  Public
const getApplicationById = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findByApplicationId(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Return limited data for security
    const responseData = {
      applicationId: application.applicationId,
      name: application.name,
      email: application.email,
      category: application.category,
      status: application.status,
      submissionTime: application.submissionTime,
      hasPublicationDocument: application.hasPublicationDocument(),
      publicationDocumentInfo: application.getPublicationDocumentInfo()
    };

    res.status(200).json({
      success: true,
      application: responseData
    });

  } catch (error) {
    console.error('[APP] Error fetching application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Download publication document
// @route   GET /api/applications/:applicationId/publication-document
// @access  Private (Add authentication middleware)
const downloadPublicationDocument = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findByApplicationId(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    if (!application.hasPublicationDocument()) {
      return res.status(404).json({
        success: false,
        message: 'No publication document found for this application'
      });
    }

    const filePath = application.publicationDocument.path;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (fileError) {
      return res.status(404).json({
        success: false,
        message: 'Publication document file not found on server'
      });
    }

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${application.publicationDocument.originalName}"`);

    // Stream the file
    res.sendFile(path.resolve(filePath));

  } catch (error) {
    console.error('[APP] Error downloading publication document:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get all applications (Admin)
// @route   GET /api/applications
// @access  Private (Add authentication middleware)
// @desc    Get all applications for authenticated user
// @route   GET /api/applications/user/list
// @access  Private
const getAllApplications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const priority = req.query.priority;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'submissionTime';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    // Build filter for user's applications only
    const filter = { userId: req.user.id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { applicationId: { $regex: search, $options: 'i' } }
      ];
    }

    const applications = await Application.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-__v -publicationDocument.path');

    const total = await Application.countDocuments(filter);

    res.status(200).json({
      success: true,
      applications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      },
      filters: {
        status,
        priority,
        search,
        sortBy,
        sortOrder: req.query.sortOrder || 'desc'
      }
    });

  } catch (error) {
    console.error('[APP] Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Update application status (Admin)
// @route   PUT /api/applications/:applicationId/status
// @access  Private (Add authentication middleware)
// @desc    Update application status
// @route   PUT /api/applications/:applicationId/status
// @access  Private
const updateApplicationStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const application = req.application; // Set by checkApplicationOwnership middleware

    // Use the new status update method with history tracking
    await application.updateStatus(status, req.user.id, remarks);

    console.log(`[APP] Status updated: ${application.applicationId} -> ${status} by ${req.user.username}`);

    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      application: {
        applicationId: application.applicationId,
        status: application.status,
        currentRemarks: application.currentRemarks,
        statusHistory: application.statusHistory
      }
    });

  } catch (error) {
    console.error('[APP] Status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get application statistics (Admin)
// @route   GET /api/applications/stats
// @access  Private (Add authentication middleware)
// @desc    Get application statistics for authenticated user
// @route   GET /api/applications/user/stats
// @access  Private
const getApplicationStats = async (req, res) => {
  try {
    // Get stats only for current user's applications
    const stats = await Application.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalApplications = await Application.countDocuments({ userId: req.user.id });

    // Get priority distribution
    const priorityStats = await Application.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent applications
    const recentApplications = await Application.find({ userId: req.user.id })
      .sort({ submissionTime: -1 })
      .limit(5)
      .select('applicationId name email status submissionTime');

    // Get applications with publications
    const publicationsCount = await Application.countDocuments({
      userId: req.user.id,
      $or: [
        { 'publicationDocument.filename': { $exists: true, $ne: null } },
        { publicationDetails: { $exists: true, $ne: '', $ne: null } }
      ]
    });

    res.status(200).json({
      success: true,
      stats: {
        total: totalApplications,
        statusDistribution: stats,
        priorityDistribution: priorityStats,
        withPublications: publicationsCount,
        recentApplications
      }
    });

  } catch (error) {
    console.error('[APP] Error fetching application stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Delete application (Admin)
// @route   DELETE /api/applications/:applicationId
// @access  Private (Add authentication middleware)
const deleteApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findOne({ applicationId });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    // Delete associated publication document file if exists
    if (application.hasPublicationDocument()) {
      try {
        await deleteUploadedFile(application.publicationDocument.path);
      } catch (fileError) {
        console.error('[APP] Error deleting publication document:', fileError);
        // Continue with application deletion even if file deletion fails
      }
    }

    // Delete the application from database
    await Application.findOneAndDelete({ applicationId });

    res.status(200).json({
      success: true,
      message: 'Application deleted successfully'
    });

  } catch (error) {
    console.error('[APP] Error deleting application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Get applications with publications (Admin)
// @route   GET /api/applications/with-publications
// @access  Private (Add authentication middleware)
const getApplicationsWithPublications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const applications = await Application.find({
      userId: req.user.id, // ADD THIS LINE - only user's applications
      $or: [
        { 'publicationDocument.filename': { $exists: true, $ne: null } },
        { publicationDetails: { $exists: true, $ne: '', $ne: null } }
      ]
    })
      .sort({ submissionTime: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v -publicationDocument.path');

    const total = await Application.countDocuments({
      $or: [
        { 'publicationDocument.filename': { $exists: true, $ne: null } },
        { publicationDetails: { $exists: true, $ne: '', $ne: null } }
      ]
    });

    res.status(200).json({
      success: true,
      applications,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    });

  } catch (error) {
    console.error('[APP] Error fetching applications with publications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// @desc    Clean up orphaned files (Admin utility)
// @route   POST /api/applications/cleanup-files
// @access  Private (Add authentication middleware)
const cleanupOrphanedFiles = async (req, res) => {
  try {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'publications');

    // Get all files in upload directory
    const files = await fs.readdir(uploadDir);

    // Get all filenames from database
    const applications = await Application.find({
      'publicationDocument.filename': { $exists: true, $ne: null }
    }).select('publicationDocument.filename');

    const dbFilenames = new Set(applications.map(app => app.publicationDocument.filename));

    // Find orphaned files
    const orphanedFiles = files.filter(file => !dbFilenames.has(file));

    // Delete orphaned files
    let deletedCount = 0;
    for (const file of orphanedFiles) {
      try {
        await fs.unlink(path.join(uploadDir, file));
        deletedCount++;
      } catch (error) {
        console.error(`[APP] Error deleting orphaned file ${file}:`, error);
      }
    }

    res.status(200).json({
      success: true,
      message: `Cleanup completed. Deleted ${deletedCount} orphaned files.`,
      details: {
        totalFiles: files.length,
        orphanedFiles: orphanedFiles.length,
        deletedFiles: deletedCount
      }
    });

  } catch (error) {
    console.error('[APP] Error cleaning up orphaned files:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


module.exports = {
  submitApplication,
  getApplicationById,
  downloadPublicationDocument,
  downloadTemplate,
  getAllApplications,
  updateApplicationStatus,
  getApplicationStats,
  getApplicationsWithPublications,
  deleteApplication,
  cleanupOrphanedFiles
};