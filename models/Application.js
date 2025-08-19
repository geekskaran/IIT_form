const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    unique: true,
    required: true,
    default: function () {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `RND${timestamp}${random}`;
    }
  },

  // Multi-user support - Link to Form Owner
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Personal Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [500, 'Address cannot exceed 500 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function (v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be 10 digits'
    }
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    validate: {
      validator: function (v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['GENERAL', 'OBC', 'SC', 'ST', 'PwD', 'EWS'],
      message: 'Invalid category selected'
    }
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function (v) {
        const today = new Date();
        const birthDate = new Date(v);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age >= 18 && age <= 65;
      },
      message: 'Age must be between 18 and 65 years'
    }
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['Male', 'Female'],
      message: 'Invalid gender selected'
    }
  },
  professionalExam: {
    type: String,
    trim: true,
    maxlength: [200, 'Professional exam name cannot exceed 200 characters']
  },
  professionalExamValidity: {
    type: Date
  },

  // Educational Qualifications (Array of objects)
  educationalQualifications: [{
    institute: {
      type: String,
      required: [true, 'Institute name is required'],
      trim: true,
      maxlength: [200, 'Institute name cannot exceed 200 characters']
    },
    examPassed: {
      type: String,
      required: [true, 'Exam passed is required'],
      enum: {
        values: [
          '10th Class',
          '12th Class',
          'Bachelors (B.Sc/B.Tech/B.E/BCA)',
          'Masters (M.Sc/M.Tech/M.E/MCA/MA)',
          'Others'
        ],
        message: 'Invalid exam type selected'
      }
    },
    nameOfExamination: {
      type: String,
      required: [true, 'Name of examination is required'],
      trim: true,
      maxlength: [100, 'Name of examination cannot exceed 100 characters']
    },
    yearOfPassing: {
      type: String,
      required: [true, 'Year of passing is required'],
      validate: {
        validator: function (v) {
          const year = parseInt(v);
          const currentYear = new Date().getFullYear();
          return year >= 1980 && year <= currentYear;
        },
        message: 'Please enter a valid year of passing'
      }
    },
    percentage: {
      type: Number,
      required: [true, 'Percentage/CGPA is required'],
      min: [0, 'Percentage cannot be negative'],
      max: [100, 'Percentage cannot exceed 100']
    },
    subjects: {
      type: String,
      trim: true,
      maxlength: [200, 'Subjects cannot exceed 200 characters']
    }
  }],

  // Work Experience (Array of objects)
  experience: [{
    organization: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [200, 'Organization name cannot exceed 200 characters']
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
      maxlength: [100, 'Designation cannot exceed 100 characters']
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (v) {
          if (this.isCurrentlyWorking) return true;
          return v && v > this.startDate;
        },
        message: 'End date must be after start date'
      }
    },
    isCurrentlyWorking: {
      type: Boolean,
      default: false
    },
    responsibilities: {
      type: String,
      trim: true,
      maxlength: [500, 'Responsibilities cannot exceed 500 characters']
    },
    salary: {
      type: Number,
      min: [0, 'Salary cannot be negative']
    }
  }],

  // Publication Details
  publicationDetails: {
    type: String,
    trim: true,
    maxlength: [2000, 'Publication details cannot exceed 2000 characters']
  },

  // Other exam details
  otherExamName: {
    type: String,
    required: function () {
      return this.examPassed === 'Others';
    },
    trim: true,
    maxlength: [100, 'Other exam name cannot exceed 100 characters'],
    validate: {
      validator: function (v) {
        if (this.examPassed === 'Others') {
          return v && v.trim().length > 0;
        }
        return true;
      },
      message: 'Please specify other exam when Others is selected'
    }
  },

  // Publication Document Info
  publicationDocument: {
    filename: {
      type: String,
      default: null
    },
    originalName: {
      type: String,
      default: null
    },
    size: {
      type: Number,
      default: null
    },
    mimeType: {
      type: String,
      default: null
    },
    uploadDate: {
      type: Date,
      default: null
    },
    path: {
      type: String,
      default: null
    }
  },

  // Declaration Agreement
  declarationAgreed: {
    type: Boolean,
    required: [true, 'Declaration agreement is required'],
    validate: {
      validator: function (v) {
        return v === true;
      },
      message: 'You must agree to the declaration to proceed'
    }
  },

  // Application Declaration
  applicationDate: {
    type: Date,
    required: [true, 'Application date is required']
  },
  applicationPlace: {
    type: String,
    required: [true, 'Application place is required'],
    trim: true,
    maxlength: [100, 'Place name cannot exceed 100 characters']
  },
  nameDeclaration: {
    type: String,
    required: [true, 'Name declaration is required'],
    trim: true,
    maxlength: [100, 'Name declaration cannot exceed 100 characters']
  },

  // Enhanced Status Management
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'interview_scheduled', 'on_hold'],
    default: 'submitted',
    index: true
  },

  // Status history for tracking changes
  statusHistory: [{
    previousStatus: {
      type: String,
      enum: ['submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'interview_scheduled', 'on_hold']
    },
    newStatus: {
      type: String,
      enum: ['submitted', 'under_review', 'shortlisted', 'approved', 'rejected', 'interview_scheduled', 'on_hold']
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [1000, 'Remarks cannot exceed 1000 characters']
    }
  }],

  // Current remarks/notes
  currentRemarks: {
    type: String,
    trim: true,
    maxlength: [1000, 'Remarks cannot exceed 1000 characters'],
    default: ''
  },

  // Priority level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },

  // Tags for organization
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],

  // Email Communication History
  emailsSent: [{
    templateId: {
      type: String,
      required: true
    },
    templateName: {
      type: String,
      required: true
    },
    subject: {
      type: String,
      required: true
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'bounced', 'opened', 'clicked'],
      default: 'sent'
    },
    errorMessage: {
      type: String,
      default: null
    }
  }],

  // Interview details
  interview: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    scheduledDate: {
      type: Date,
      default: null
    },
    scheduledTime: {
      type: String,
      default: null
    },
    location: {
      type: String,
      trim: true,
      maxlength: [200, 'Location cannot exceed 200 characters']
    },
    type: {
      type: String,
      enum: ['in_person', 'video_call', 'phone_call'],
      default: 'in_person'
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Interview notes cannot exceed 1000 characters']
    },
    conductedBy: {
      type: String,
      trim: true,
      maxlength: [100, 'Interviewer name cannot exceed 100 characters']
    },
    result: {
      type: String,
      enum: ['pending', 'passed', 'failed', 'rescheduled'],
      default: 'pending'
    }
  },

  // Application scoring/rating
  rating: {
    overall: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    technical: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    communication: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    experience: {
      type: Number,
      min: 0,
      max: 10,
      default: null
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Rating notes cannot exceed 500 characters']
    }
  },

  // Additional metadata
  metadata: {
    source: {
      type: String,
      default: 'web_form'
    },
    referrer: {
      type: String,
      default: null
    },
    userAgent: {
      type: String,
      default: null
    },
    deviceInfo: {
      type: String,
      default: null
    }
  },

  // Applicant interaction tracking
  interactions: [{
    type: {
      type: String,
      enum: ['email_sent', 'email_opened', 'email_clicked', 'status_changed', 'note_added', 'interview_scheduled'],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    details: {
      type: String,
      trim: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // System fields
  submissionTime: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better performance
ApplicationSchema.index({ applicationId: 1 });
ApplicationSchema.index({ email: 1 });
ApplicationSchema.index({ submissionTime: -1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ userId: 1, status: 1 });
ApplicationSchema.index({ userId: 1, submissionTime: -1 });
ApplicationSchema.index({ userId: 1, priority: 1 });
ApplicationSchema.index({ 'interview.isScheduled': 1, 'interview.scheduledDate': 1 });
ApplicationSchema.index({ tags: 1 });
ApplicationSchema.index({ 'rating.overall': 1 });

// Pre-save middleware to ensure data consistency
ApplicationSchema.pre('save', function (next) {
  // Convert name and nameDeclaration to uppercase for consistency
  if (this.name) {
    this.name = this.name.toUpperCase();
  }
  if (this.nameDeclaration) {
    this.nameDeclaration = this.nameDeclaration.toUpperCase();
  }

  // Validate experience array
  if (this.experience && this.experience.length > 0) {
    this.experience.forEach(exp => {
      if (exp.isCurrentlyWorking) {
        exp.endDate = null; // Clear end date if currently working
      }
    });
  }

  next();
});

// Instance methods
ApplicationSchema.methods.toJSON = function () {
  const application = this.toObject();
  delete application.__v;
  return application;
};

ApplicationSchema.methods.hasPublicationDocument = function () {
  return this.publicationDocument && this.publicationDocument.filename;
};

ApplicationSchema.methods.getPublicationDocumentInfo = function () {
  if (!this.hasPublicationDocument()) {
    return null;
  }
  return {
    filename: this.publicationDocument.filename,
    originalName: this.publicationDocument.originalName,
    size: this.publicationDocument.size,
    uploadDate: this.publicationDocument.uploadDate
  };
};

// Method to update status with history tracking
ApplicationSchema.methods.updateStatus = async function(newStatus, changedBy, remarks = '') {
  // Add to history
  this.statusHistory.push({
    previousStatus: this.status,
    newStatus: newStatus,
    changedBy: changedBy,
    changedAt: new Date(),
    remarks: remarks
  });
  
  // Update current status and remarks
  this.status = newStatus;
  this.currentRemarks = remarks;
  
  // Add interaction
  this.interactions.push({
    type: 'status_changed',
    details: `Status changed from ${this.status} to ${newStatus}`,
    performedBy: changedBy
  });
  
  await this.save();
  
  // Update user stats
  const User = require('./User');
  const user = await User.findById(this.userId);
  if (user) {
    await user.updateStats();
  }
};

// Method to add email to history
ApplicationSchema.methods.addEmailHistory = function(emailData) {
  this.emailsSent.push({
    templateId: emailData.templateId,
    templateName: emailData.templateName,
    subject: emailData.subject,
    sentBy: emailData.sentBy,
    status: emailData.status || 'sent',
    errorMessage: emailData.errorMessage || null
  });
  
  // Add interaction
  this.interactions.push({
    type: 'email_sent',
    details: `Email sent: ${emailData.subject}`,
    performedBy: emailData.sentBy
  });
};

// Method to schedule interview
ApplicationSchema.methods.scheduleInterview = async function(interviewData, scheduledBy) {
  this.interview = {
    isScheduled: true,
    scheduledDate: interviewData.date,
    scheduledTime: interviewData.time,
    location: interviewData.location,
    type: interviewData.type,
    notes: interviewData.notes,
    conductedBy: interviewData.conductedBy
  };
  
  // Update status if not already interview_scheduled
  if (this.status !== 'interview_scheduled') {
    await this.updateStatus('interview_scheduled', scheduledBy, 'Interview scheduled');
  }
  
  // Add interaction
  this.interactions.push({
    type: 'interview_scheduled',
    details: `Interview scheduled for ${interviewData.date} at ${interviewData.time}`,
    performedBy: scheduledBy
  });
  
  await this.save();
};

// Method to add rating
ApplicationSchema.methods.addRating = function(ratingData, ratedBy) {
  this.rating = {
    overall: ratingData.overall,
    technical: ratingData.technical,
    communication: ratingData.communication,
    experience: ratingData.experience,
    notes: ratingData.notes
  };
  
  this.interactions.push({
    type: 'note_added',
    details: `Rating added: Overall ${ratingData.overall}/10`,
    performedBy: ratedBy
  });
};

// Method to get status color for UI
ApplicationSchema.methods.getStatusColor = function() {
  const colors = {
    'submitted': '#6b7280',
    'under_review': '#f59e0b',
    'shortlisted': '#3b82f6',
    'interview_scheduled': '#8b5cf6',
    'approved': '#10b981',
    'rejected': '#ef4444',
    'on_hold': '#f97316'
  };
  return colors[this.status] || '#6b7280';
};

// Method to check if can be edited
ApplicationSchema.methods.canBeEdited = function() {
  return ['submitted', 'under_review'].includes(this.status);
};

// Method to get days since submission
ApplicationSchema.methods.getDaysSinceSubmission = function() {
  const diffTime = Math.abs(new Date() - this.submissionTime);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Static methods
ApplicationSchema.statics.findByApplicationId = function (applicationId) {
  return this.findOne({ applicationId });
};

ApplicationSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase() });
};

ApplicationSchema.statics.getRecentApplications = function (limit = 10) {
  return this.find({}).sort({ submissionTime: -1 }).limit(limit);
};

ApplicationSchema.statics.getApplicationsWithPublications = function () {
  return this.find({
    $or: [
      { 'publicationDocument.filename': { $exists: true, $ne: null } },
      { publicationDetails: { $exists: true, $ne: '', $ne: null } }
    ]
  });
};

ApplicationSchema.statics.getApplicationStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Find applications by user with filters
ApplicationSchema.statics.findByUserWithFilters = function(userId, filters = {}) {
  const query = { userId };
  
  if (filters.status && filters.status !== 'all') {
    query.status = filters.status;
  }
  
  if (filters.priority && filters.priority !== 'all') {
    query.priority = filters.priority;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }
  
  if (filters.dateRange) {
    query.submissionTime = {
      $gte: new Date(filters.dateRange.start),
      $lte: new Date(filters.dateRange.end)
    };
  }
  
  return this.find(query).sort({ submissionTime: -1 });
};

// Get application statistics for a user
ApplicationSchema.statics.getStatsByUser = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgRating: { $avg: '$rating.overall' }
      }
    }
  ]);
};

// Get recent applications for a user
ApplicationSchema.statics.getRecentByUser = function(userId, limit = 5) {
  return this.find({ userId })
    .sort({ submissionTime: -1 })
    .limit(limit)
    .select('applicationId name email status submissionTime');
};

module.exports = mongoose.model('Application', ApplicationSchema);