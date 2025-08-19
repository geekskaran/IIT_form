const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // Basic Information
  userId: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return 'USER_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    validate: {
      validator: function(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  
  // Profile Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  organization: {
    type: String,
    trim: true,
    maxlength: [100, 'Organization name cannot exceed 100 characters']
  },
  
  // Form Configuration
  formConfig: {
    title: {
      type: String,
      default: 'Application Form',
      maxlength: [100, 'Form title cannot exceed 100 characters']
    },
    description: {
      type: String,
      default: 'Please fill out this application form',
      maxlength: [500, 'Form description cannot exceed 500 characters']
    },
    customHeadings: [{
      text: {
        type: String,
        trim: true,
        maxlength: [200, 'Custom heading cannot exceed 200 characters']
      },
      position: {
        type: String,
        enum: ['top', 'middle', 'bottom'],
        default: 'top'
      },
      isActive: {
        type: Boolean,
        default: true
      }
    }],
    advertisement: {
      filename: String,
      originalName: String,
      size: Number,
      mimeType: String,
      uploadDate: Date,
      path: String
    },
    isActive: {
      type: Boolean,
      default: true
    },
    acceptingApplications: {
      type: Boolean,
      default: true
    }
  },
  
  // System Fields
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  
  // Statistics
  stats: {
    totalApplications: {
      type: Number,
      default: 0
    },
    pendingApplications: {
      type: Number,
      default: 0
    },
    approvedApplications: {
      type: Number,
      default: 0
    },
    rejectedApplications: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ userId: 1 });
UserSchema.index({ isActive: 1 });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate form link
UserSchema.methods.getFormLink = function() {
  return `/form/${this.userId}`;
};

// Get full name
UserSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Update statistics
UserSchema.methods.updateStats = async function() {
  const Application = require('./Application');
  
  const stats = await Application.aggregate([
    { $match: { userId: this._id } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Reset stats
  this.stats.totalApplications = 0;
  this.stats.pendingApplications = 0;
  this.stats.approvedApplications = 0;
  this.stats.rejectedApplications = 0;

  // Update stats based on aggregation
  stats.forEach(stat => {
    switch (stat._id) {
      case 'submitted':
      case 'under_review':
      case 'shortlisted':
      case 'interview_scheduled':
        this.stats.pendingApplications += stat.count;
        break;
      case 'approved':
        this.stats.approvedApplications += stat.count;
        break;
      case 'rejected':
        this.stats.rejectedApplications += stat.count;
        break;
    }
    this.stats.totalApplications += stat.count;
  });

  await this.save();
};

// Check if user can accept applications
UserSchema.methods.canAcceptApplications = function() {
  return this.isActive && this.formConfig.isActive && this.formConfig.acceptingApplications;
};

// Remove password from JSON output
UserSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Static methods
UserSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, isActive: true });
};

UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase(), isActive: true });
};

UserSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username.toLowerCase(), isActive: true });
};

module.exports = mongoose.model('User', UserSchema);