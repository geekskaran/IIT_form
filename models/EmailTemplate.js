const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    unique: true,
    required: true,
    default: function() {
      return 'TEMPLATE_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    maxlength: [100, 'Template name cannot exceed 100 characters']
  },
  subject: {
    type: String,
    required: [true, 'Email subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  body: {
    type: String,
    required: [true, 'Email body is required'],
    maxlength: [10000, 'Email body cannot exceed 10000 characters']
  },
  
  // Template variables that can be used
  variables: [{
    name: {
      type: String,
      required: true,
      trim: true
    }, // e.g., 'applicantName', 'applicationId'
    description: {
      type: String,
      trim: true
    }, // e.g., 'Applicant\'s full name'
    defaultValue: {
      type: String,
      default: ''
    }
  }],
  
  // Template category for organization
  category: {
    type: String,
    enum: ['approval', 'rejection', 'shortlist', 'interview', 'follow_up', 'general'],
    default: 'general'
  },
  
  // Template status
  isActive: {
    type: Boolean,
    default: true
  },
  isDraft: {
    type: Boolean,
    default: false
  },
  
  // Usage statistics
  usageStats: {
    totalSent: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date,
      default: null
    }
  },
  
  // Template settings
  settings: {
    autoIncludeAttachments: {
      type: Boolean,
      default: false
    },
    trackOpens: {
      type: Boolean,
      default: false
    },
    allowUnsubscribe: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
EmailTemplateSchema.index({ userId: 1, name: 1 });
EmailTemplateSchema.index({ userId: 1, category: 1 });
EmailTemplateSchema.index({ userId: 1, isActive: 1 });
EmailTemplateSchema.index({ templateId: 1 });

// Pre-save middleware
EmailTemplateSchema.pre('save', function(next) {
  // Set default variables if not provided
  if (!this.variables || this.variables.length === 0) {
    this.variables = [
      {
        name: 'applicantName',
        description: 'Full name of the applicant',
        defaultValue: '[Applicant Name]'
      },
      {
        name: 'applicationId',
        description: 'Unique application ID',
        defaultValue: '[Application ID]'
      },
      {
        name: 'organizationName',
        description: 'Name of your organization',
        defaultValue: '[Organization Name]'
      },
      {
        name: 'currentDate',
        description: 'Current date',
        defaultValue: new Date().toLocaleDateString()
      }
    ];
  }
  
  next();
});

// Instance methods
EmailTemplateSchema.methods.toJSON = function() {
  const template = this.toObject();
  delete template.__v;
  return template;
};

// Method to replace variables in template
EmailTemplateSchema.methods.processTemplate = function(variables = {}) {
  let processedSubject = this.subject;
  let processedBody = this.body;
  
  // Add default variables
  const defaultVars = {
    currentDate: new Date().toLocaleDateString(),
    currentTime: new Date().toLocaleTimeString(),
    ...variables
  };
  
  // Replace variables in subject and body
  Object.keys(defaultVars).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processedSubject = processedSubject.replace(regex, defaultVars[key]);
    processedBody = processedBody.replace(regex, defaultVars[key]);
  });
  
  return {
    subject: processedSubject,
    body: processedBody
  };
};

// Method to increment usage stats
EmailTemplateSchema.methods.incrementUsage = async function() {
  this.usageStats.totalSent += 1;
  this.usageStats.lastUsed = new Date();
  await this.save();
};

// Method to get available variables
EmailTemplateSchema.methods.getAvailableVariables = function() {
  return this.variables.map(v => ({
    name: v.name,
    description: v.description,
    syntax: `{{${v.name}}}`
  }));
};

// Static methods
EmailTemplateSchema.statics.findByUserId = function(userId, options = {}) {
  const query = { userId, isActive: true };
  
  if (options.category) {
    query.category = options.category;
  }
  
  if (options.includeDrafts === false) {
    query.isDraft = false;
  }
  
  return this.find(query).sort({ updatedAt: -1 });
};

EmailTemplateSchema.statics.findByTemplateId = function(templateId, userId) {
  return this.findOne({ templateId, userId, isActive: true });
};

EmailTemplateSchema.statics.getPopularTemplates = function(userId, limit = 5) {
  return this.find({ 
    userId, 
    isActive: true,
    'usageStats.totalSent': { $gt: 0 }
  })
  .sort({ 'usageStats.totalSent': -1 })
  .limit(limit);
};

EmailTemplateSchema.statics.getTemplatesByCategory = function(userId) {
  return this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), isActive: true } },
    { 
      $group: {
        _id: '$category',
        templates: { $push: '$$ROOT' },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id': 1 } }
  ]);
};

module.exports = mongoose.model('EmailTemplate', EmailTemplateSchema);