const User = require('../models/User');
const Application = require('../models/Application');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d'
  });
};

// Configure multer for advertisement uploads
const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'advertisements');
    try {
      await fs.access(uploadDir);
    } catch (error) {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'ad-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, GIF images and PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// @desc    User registration
// @route   POST /api/users/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, organization } = req.body;

    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists',
        code: 'USER_ALREADY_EXISTS'
      });
    }

    // Create user
    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      organization
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    console.log(`[USER] Registration successful: ${username} (${email})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        formLink: user.getFormLink(),
        formConfig: user.formConfig
      }
    });

  } catch (error) {
    console.error('[USER] Registration error:', error);
    
    // Handle mongoose validation errors
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

// @desc    User login
// @route   POST /api/users/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login and stats
    user.lastLogin = new Date();
    await user.updateStats();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    console.log(`[USER] Login successful: ${user.username} (${email})`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        formLink: user.getFormLink(),
        formConfig: user.formConfig,
        stats: user.stats,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('[USER] Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update stats
    await user.updateStats();

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        formLink: user.getFormLink(),
        formConfig: user.formConfig,
        stats: user.stats,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('[USER] Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, organization } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (organization !== undefined) user.organization = organization;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        userId: user.userId,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organization: user.organization,
        formLink: user.getFormLink(),
        formConfig: user.formConfig
      }
    });

  } catch (error) {
    console.error('[USER] Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Update form configuration
// @route   PUT /api/users/form-config
// @access  Private
const updateFormConfig = async (req, res) => {
  try {
    const { title, description, customHeadings, isActive, acceptingApplications } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update form configuration
    if (title !== undefined) user.formConfig.title = title;
    if (description !== undefined) user.formConfig.description = description;
    if (customHeadings !== undefined) user.formConfig.customHeadings = customHeadings;
    if (isActive !== undefined) user.formConfig.isActive = isActive;
    if (acceptingApplications !== undefined) user.formConfig.acceptingApplications = acceptingApplications;

    await user.save();

    console.log(`[USER] Form config updated: ${user.username}`);

    res.status(200).json({
      success: true,
      message: 'Form configuration updated successfully',
      formConfig: user.formConfig,
      formLink: user.getFormLink()
    });

  } catch (error) {
    console.error('[USER] Update form config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Upload advertisement file
// @route   POST /api/users/upload-advertisement
// @access  Private
const uploadAdvertisement = async (req, res) => {
  const uploadMiddleware = upload.single('advertisement');
  
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      console.error('[USER] Advertisement upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
        code: 'UPLOAD_ERROR'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded',
          code: 'NO_FILE'
        });
      }

      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Delete old advertisement file if exists
      if (user.formConfig.advertisement && user.formConfig.advertisement.path) {
        try {
          await fs.unlink(user.formConfig.advertisement.path);
        } catch (deleteError) {
          console.error('[USER] Error deleting old advertisement:', deleteError);
        }
      }

      // Update user with new advertisement info
      user.formConfig.advertisement = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        uploadDate: new Date(),
        path: req.file.path
      };

      await user.save();

      console.log(`[USER] Advertisement uploaded: ${user.username} - ${req.file.originalname}`);

      res.status(200).json({
        success: true,
        message: 'Advertisement uploaded successfully',
        advertisement: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          uploadDate: user.formConfig.advertisement.uploadDate
        }
      });

    } catch (error) {
      console.error('[USER] Advertisement processing error:', error);
      
      // Clean up uploaded file on error
      if (req.file && req.file.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.error('[USER] Error cleaning up file:', cleanupError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  });
};

// @desc    Delete advertisement file
// @route   DELETE /api/users/advertisement
// @access  Private
const deleteAdvertisement = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.formConfig.advertisement || !user.formConfig.advertisement.path) {
      return res.status(404).json({
        success: false,
        message: 'No advertisement file found',
        code: 'NO_ADVERTISEMENT'
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(user.formConfig.advertisement.path);
    } catch (deleteError) {
      console.error('[USER] Error deleting advertisement file:', deleteError);
    }

    // Clear advertisement from database
    user.formConfig.advertisement = {
      filename: null,
      originalName: null,
      size: null,
      mimeType: null,
      uploadDate: null,
      path: null
    };

    await user.save();

    console.log(`[USER] Advertisement deleted: ${user.username}`);

    res.status(200).json({
      success: true,
      message: 'Advertisement deleted successfully'
    });

  } catch (error) {
    console.error('[USER] Delete advertisement error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get user's applications with filtering and pagination
// @route   GET /api/users/applications
// @access  Private
const getUserApplications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const priority = req.query.priority;
    const search = req.query.search;
    const sortBy = req.query.sortBy || 'submissionTime';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    // Build filter
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

    // Get applications
    const applications = await Application.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-__v -publicationDocument.path');

    const total = await Application.countDocuments(filter);

    // Get status counts for dashboard
    const statusCounts = await Application.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get priority counts
    const priorityCounts = await Application.aggregate([
      { $match: { userId: req.user.id } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

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
      },
      counts: {
        status: statusCounts,
        priority: priorityCounts,
        total
      }
    });

  } catch (error) {
    console.error('[USER] Get applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Get user dashboard stats
// @route   GET /api/users/dashboard-stats
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update and get fresh stats
    await user.updateStats();

    // Get recent applications
    const recentApplications = await Application.getRecentByUser(req.user.id, 5);

    // Get applications trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyApplications = await Application.aggregate([
      { 
        $match: { 
          userId: req.user.id,
          submissionTime: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$submissionTime" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      stats: user.stats,
      recentApplications,
      weeklyTrend: weeklyApplications,
      formConfig: {
        isActive: user.formConfig.isActive,
        acceptingApplications: user.formConfig.acceptingApplications,
        title: user.formConfig.title,
        formLink: user.getFormLink()
      }
    });

  } catch (error) {
    console.error('[USER] Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
        code: 'MISSING_PASSWORDS'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`[USER] Password changed: ${user.username}`);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('[USER] Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

module.exports = {
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
};