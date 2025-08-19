const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Compression middleware
app.use(compression());

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for certain routes in development
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      return false; // Don't skip in development for testing
    }
    return false;
  }
});

app.use('/api/', globalLimiter);

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON format',
        code: 'INVALID_JSON'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d', // Cache for 1 day
  etag: true,
  lastModified: true
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// Custom middleware for request logging and monitoring
app.use((req, res, next) => {
  // Add request ID for tracking
  req.id = Math.random().toString(36).substr(2, 9);
  
  // Log request details
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.id} - ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')?.slice(0, 100)}`);
  
  // Add response time tracking
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'ERROR' : 'INFO';
    console.log(`[${new Date().toISOString()}] ${req.id} - ${logLevel} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// MongoDB connection with enhanced configuration
const connectDB = async () => {
  try {
    const mongoOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      // bufferMaxEntries: 0, // Disable mongoose bufferingc
      bufferCommands: false, // Disable mongoose buffering
    };

    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/iit_patna_rnd_multiuser',
      mongoOptions
    );

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // MongoDB connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// API Routes - Multi-user System

// Health check route (should be first)
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({
    success: true,
    message: 'Multi-user Application API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '2.0.0',
    database: {
      status: dbStatus,
      name: mongoose.connection.name
    },
    features: [
      'Multi-user form management',
      'Email template system',
      'Application status tracking',
      'File upload support',
      'Bulk email sending'
    ]
  });
});

// User management routes (authentication, profile, form config)
app.use('/api/users', require('./routes/users'));

// Email management routes (templates, bulk sending)
app.use('/api/email', require('./routes/email'));

// Application management routes (submissions, status updates)
app.use('/api/applications', require('./routes/applications'));

// Legacy admin routes (keep existing admin functionality)
app.use('/api/auth', require('./routes/auth'));

// OTP Routes (existing functionality)
const { sendOTP, verifyOTP, checkVerification } = require('./controllers/otpController');
app.post('/api/send-otp', sendOTP);
app.post('/api/verify-otp', verifyOTP);
app.post('/api/check-verification', checkVerification);

// Root route with API documentation
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Multi-User Application Form API',
    version: '2.0.0',
    documentation: {
      health: 'GET /api/health',
      users: {
        register: 'POST /api/users/register',
        login: 'POST /api/users/login',
        profile: 'GET /api/users/profile',
        updateProfile: 'PUT /api/users/profile',
        formConfig: 'PUT /api/users/form-config',
        applications: 'GET /api/users/applications',
        dashboard: 'GET /api/users/dashboard-stats'
      },
      applications: {
        submitForm: 'POST /api/applications/form/:userId',
        getFormConfig: 'GET /api/applications/form/:userId/config',
        getApplication: 'GET /api/applications/:applicationId',
        updateStatus: 'PUT /api/applications/:applicationId/status',
        userApplications: 'GET /api/applications/user/list'
      },
      email: {
        templates: 'GET /api/email/templates',
        createTemplate: 'POST /api/email/templates',
        sendBulk: 'POST /api/email/send-bulk',
        history: 'GET /api/email/history'
      }
    },
    features: {
      multiUser: 'Each user can create their own forms',
      customization: 'Form titles, descriptions, and advertisements',
      emailSystem: 'Template-based bulk email sending',
      statusTracking: 'Application status management with remarks',
      fileUploads: 'Publication documents and advertisements',
      authentication: 'JWT-based user authentication'
    }
  });
});

// Catch-all route for API documentation
app.get('/api', (req, res) => {
  res.redirect('/');
});

// Global error handler
app.use((err, req, res, next) => {
  // Log error with request context
  console.error(`❌ Unhandled error in ${req.method} ${req.path}:`, {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors,
      code: 'VALIDATION_ERROR',
      requestId: req.id
    });
  }
  
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `Duplicate ${field} found. This ${field} is already in use.`,
      code: 'DUPLICATE_ENTRY',
      field: field,
      requestId: req.id
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
      code: 'INVALID_TOKEN',
      requestId: req.id
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired',
      code: 'TOKEN_EXPIRED',
      requestId: req.id
    });
  }
  
  // Request entity too large
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request entity too large. Maximum allowed size is 10MB.',
      code: 'ENTITY_TOO_LARGE',
      requestId: req.id
    });
  }
  
  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: 'Cross-origin request not allowed',
      code: 'CORS_ERROR',
      requestId: req.id
    });
  }
  
  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError') {
    return res.status(503).json({
      success: false,
      message: 'Database temporarily unavailable',
      code: 'DATABASE_ERROR',
      requestId: req.id
    });
  }
  
  // File system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      message: 'Requested file not found',
      code: 'FILE_NOT_FOUND',
      requestId: req.id
    });
  }
  
  if (err.code === 'EACCES') {
    return res.status(403).json({
      success: false,
      message: 'File access denied',
      code: 'FILE_ACCESS_DENIED',
      requestId: req.id
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error. Please try again later.',
    code: 'INTERNAL_ERROR',
    requestId: req.id,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    availableRoutes: {
      users: '/api/users',
      applications: '/api/applications', 
      email: '/api/email',
      health: '/api/health'
    }
  });
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new requests
  const server = app.listen(PORT);
  server.close(() => {
    console.log('🔒 HTTP server closed');
    
    // Close MongoDB connection
    mongoose.connection.close(() => {
      console.log('📄 MongoDB connection closed');
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown due to timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Promise Rejection:', {
    error: err.message,
    stack: err.stack
  });
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 ============================================');
  console.log('🎯 Multi-User Application Form API Started');
  console.log('🚀 ============================================');
  console.log(`📍 Server: http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/api/health`);
  console.log(`📚 Docs: http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set (using default)'}`);
  console.log(`📧 SMTP: ${process.env.SMTP_USER ? '✅ Configured' : '❌ Not configured'}`);
  console.log('🚀 ============================================');
  
  // Log available routes
  console.log('📋 Available API Endpoints:');
  console.log('   👤 Users: /api/users/*');
  console.log('   📧 Email: /api/email/*');
  console.log('   📝 Apps: /api/applications/*');
  console.log('   🔐 Auth: /api/auth/* (legacy)');
  console.log('🚀 ============================================');
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', err);
  }
});

module.exports = app;