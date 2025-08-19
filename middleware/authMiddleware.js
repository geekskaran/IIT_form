const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware for protecting routes
 * Validates JWT token and attaches user info to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid token provided',
        code: 'NO_TOKEN'
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token is empty',
        code: 'EMPTY_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user info to request
    req.user = {
      id: user._id,
      userId: user.userId,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      organization: user.organization,
      role: 'user'
    };

    next();
  } catch (error) {
    console.error('[AUTH] Token verification error:', error);
    
    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Generic error
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = {
          id: user._id,
          userId: user.userId,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          organization: user.organization,
          role: 'user'
        };
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Admin authentication middleware
 * Checks for both user auth and admin role
 */
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Check if it's admin token (from existing Admin model)
    const Admin = require('../models/Admin');
    const admin = await Admin.findById(decoded.adminId);
    
    if (admin && admin.isActive) {
      req.user = {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        type: 'admin'
      };
      return next();
    }
    
    // If not admin, check if it's a super user
    const user = await User.findById(decoded.userId).select('-password');
    if (user && user.isActive && user.role === 'super_admin') {
      req.user = {
        id: user._id,
        userId: user.userId,
        email: user.email,
        username: user.username,
        role: 'super_admin',
        type: 'user'
      };
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required',
      code: 'INSUFFICIENT_PRIVILEGES'
    });
    
  } catch (error) {
    console.error('[AUTH] Admin auth error:', error);
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
};

/**
 * Middleware to check if user owns the resource
 */
const checkResourceOwnership = (resourceField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const resourceId = req.params[resourceField] || req.body[resourceField];
      
      if (resourceId && resourceId !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You can only access your own resources',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('[AUTH] Resource ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Authorization error',
        code: 'AUTHZ_ERROR'
      });
    }
  };
};

/**
 * Middleware to validate form access
 */
const validateFormAccess = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'MISSING_USER_ID'
      });
    }

    const User = require('../models/User');
    const formOwner = await User.findOne({ userId, isActive: true });
    
    if (!formOwner) {
      return res.status(404).json({
        success: false,
        message: 'Form not found or inactive',
        code: 'FORM_NOT_FOUND'
      });
    }

    if (!formOwner.canAcceptApplications()) {
      return res.status(403).json({
        success: false,
        message: 'This form is not currently accepting applications',
        code: 'FORM_CLOSED'
      });
    }

    req.formOwner = formOwner;
    next();
  } catch (error) {
    console.error('[AUTH] Form access validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Form validation error',
      code: 'FORM_VALIDATION_ERROR'
    });
  }
};

/**
 * Rate limiting middleware for authentication attempts
 */
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    // Clean old attempts
    const userAttempts = attempts.get(ip) || [];
    const recentAttempts = userAttempts.filter(attempt => now - attempt < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Too many authentication attempts. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000)
      });
    }
    
    // Add current attempt on failed auth (you can call this in auth controllers)
    req.recordFailedAttempt = () => {
      recentAttempts.push(now);
      attempts.set(ip, recentAttempts);
    };
    
    next();
  };
};

/**
 * Middleware to check application ownership
 */
const checkApplicationOwnership = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    
    if (!applicationId) {
      return res.status(400).json({
        success: false,
        message: 'Application ID is required',
        code: 'MISSING_APPLICATION_ID'
      });
    }

    const Application = require('../models/Application');
    const application = await Application.findOne({ applicationId });
    
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
        code: 'APPLICATION_NOT_FOUND'
      });
    }

    // Check if user owns this application's form
    if (application.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access applications for your forms',
        code: 'APPLICATION_ACCESS_DENIED'
      });
    }

    req.application = application;
    next();
  } catch (error) {
    console.error('[AUTH] Application ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Authorization error',
      code: 'APPLICATION_AUTHZ_ERROR'
    });
  }
};

/**
 * Middleware to validate email template ownership
 */
const checkTemplateOwnership = async (req, res, next) => {
  try {
    const { templateId } = req.params;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required',
        code: 'MISSING_TEMPLATE_ID'
      });
    }

    const EmailTemplate = require('../models/EmailTemplate');
    const template = await EmailTemplate.findOne({ templateId });
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found',
        code: 'TEMPLATE_NOT_FOUND'
      });
    }

    if (template.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own email templates',
        code: 'TEMPLATE_ACCESS_DENIED'
      });
    }

    req.template = template;
    next();
  } catch (error) {
    console.error('[AUTH] Template ownership check error:', error);
    res.status(500).json({
      success: false,
      message: 'Template authorization error',
      code: 'TEMPLATE_AUTHZ_ERROR'
    });
  }
};

/**
 * Middleware to log user activities
 */
const logUserActivity = (activity) => {
  return (req, res, next) => {
    if (req.user) {
      console.log(`[ACTIVITY] User ${req.user.username} (${req.user.email}) performed: ${activity} at ${new Date().toISOString()}`);
    }
    next();
  };
};

/**
 * Error handler for authentication middleware
 */
const authErrorHandler = (err, req, res, next) => {
  console.error('[AUTH] Authentication error:', err);
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED'
    });
  }
  
  if (err.name === 'NotBeforeError') {
    return res.status(401).json({
      success: false,
      message: 'Token not active',
      code: 'TOKEN_NOT_ACTIVE'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Authentication system error',
    code: 'AUTH_SYSTEM_ERROR'
  });
};

module.exports = {
  authMiddleware,
  optionalAuth,
  adminAuth,
  checkResourceOwnership,
  validateFormAccess,
  authRateLimit,
  checkApplicationOwnership,
  checkTemplateOwnership,
  logUserActivity,
  authErrorHandler
};