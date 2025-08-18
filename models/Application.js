
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

        // Calculate age more accurately
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
  // Remove the entire validate block
},

  // Educational Qualifications (Array of objects) - Updated with nameOfExamination
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
      'Others'  // ADD THIS
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
          return year >= 1970 && year <= currentYear + 1;
        },
        message: 'Invalid year of passing'
      }
    },
    marksPercentage: {
      type: String,
      required: [true, 'Marks/Percentage is required'],
      trim: true,
      maxlength: [10, 'Marks/Percentage cannot exceed 10 characters']
    }
  }],

  // Experience (Array of objects)
  experience: [{
    companyName: {
      type: String,
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters']
    },
    startDate: {
      type: Date,
      
    },
endDate: {
  type: Date
  // Remove the entire validate block
},
    isCurrentlyWorking: {
      type: Boolean,
      default: false
    },
    salary: {
      type: String,
     
      trim: true,
      maxlength: [50, 'Salary cannot exceed 50 characters']
    }
  }],

  // Qualifying Degree
  qualifyingDegree: {
    type: String,
    required: [true, 'Qualifying degree is required'],
    enum: {
      values: ['B.Sc/B.Tech/B.E/BCA', 'M.Sc/M.Tech/M.E/MA/MCA', 'Others'],
      message: 'Invalid qualifying degree selected'
    }
  },
  qualifyingDegreeOther: {
    type: String,
    required: function () {
      return this.qualifyingDegree === 'Others';
    },
    trim: true,
    maxlength: [200, 'Other degree cannot exceed 200 characters'],
    validate: {
      validator: function (v) {
        if (this.qualifyingDegree === 'Others') {
          return v && v.trim().length > 0;
        }
        return true;
      },
      message: 'Please specify other qualifying degree when Others is selected'
    }
  },
  degreeMajorSpecialization: {
    type: String,
    required: [true, 'Degree specialization is required'],
    trim: true,
    maxlength: [200, 'Specialization cannot exceed 200 characters']
  },

  // Publication Details
  publicationDetails: {
    type: String,
    trim: true,
    maxlength: [5000, 'Publication details cannot exceed 5000 characters']
  },

  examPassedOther: {
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

  // Declaration Agreement - NEW FIELD
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

  // System fields
  submissionTime: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'rejected'],
    default: 'submitted'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for better performance
ApplicationSchema.index({ applicationId: 1 });
ApplicationSchema.index({ email: 1 });
ApplicationSchema.index({ submissionTime: -1 });
ApplicationSchema.index({ status: 1 });

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
  // Remove sensitive data when converting to JSON
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

module.exports = mongoose.model('Application', ApplicationSchema);