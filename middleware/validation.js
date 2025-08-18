


// middleware/validation.js
const { body } = require('express-validator');

// Validation rules for application submission
const validateApplicationSubmission = [
  // Personal Information
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters')
    .matches(/^[a-zA-Z\s.]+$/)
    .withMessage('Name should contain only letters, spaces, and dots'),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ max: 500 })
    .withMessage('Address cannot exceed 500 characters'),

  body('phone')
    .matches(/^[0-9]{10}$/)
    .withMessage('Phone number must be 10 digits'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),

  body('category')
    .isIn(['GENERAL', 'OBC', 'SC', 'ST', 'PwD', 'EWS'])
    .withMessage('Invalid category selected'),

  body('dob')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const today = new Date();
      const birthDate = new Date(value);

      // Calculate age more accurately
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18 || age > 65) {
        throw new Error('Age must be between 18 and 65 years');
      }
      return true;
    }),
    
    body('gender')
  .isIn(['Male', 'Female'])
  .withMessage('Invalid gender selected'),

  body('professionalExam')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Professional exam name cannot exceed 200 characters'),

  body('professionalExamValidity')
    .optional()
    .isISO8601()
    .withMessage('Invalid validity date format'),
  // Educational Qualifications
  body('educationalQualifications')
    .isArray({ min: 1 })
    .withMessage('At least one educational qualification is required'),

  body('educationalQualifications.*.institute')
    .trim()
    .notEmpty()
    .withMessage('Institute name is required')
    .isLength({ max: 200 })
    .withMessage('Institute name cannot exceed 200 characters'),

body('educationalQualifications.*.examPassed')
  .isIn([
    '10th Class',
    '12th Class',
    'Bachelors (B.Sc/B.Tech/B.E/BCA)',
    'Masters (M.Sc/M.Tech/M.E/MCA/MA)',
    'Others'  // ADD THIS
  ])
  .withMessage('Invalid exam type selected'),
  // Add this after the existing examPassed validation:
  body('educationalQualifications.*.examPassedOther')
    .optional()
    .trim()
    .custom((value, { req, path }) => {
      const index = path.match(/\[(\d+)\]/)[1];
      const examPassed = req.body.educationalQualifications[index]?.examPassed;

      if (examPassed === 'Others') {
        if (!value || value.trim().length === 0) {
          throw new Error('Please specify other exam when Others is selected');
        }
        if (value.length > 100) {
          throw new Error('Other exam name cannot exceed 100 characters');
        }
      }
      return true;
    }),
  // NEW VALIDATION: Name of Examination
  body('educationalQualifications.*.nameOfExamination')
    .trim()
    .notEmpty()
    .withMessage('Name of examination is required')
    .isLength({ max: 100 })
    .withMessage('Name of examination cannot exceed 100 characters'),

  body('educationalQualifications.*.yearOfPassing')
    .matches(/^[0-9]{4}$/)
    .withMessage('Year must be a 4-digit number')
    .custom((value) => {
      const year = parseInt(value);
      const currentYear = new Date().getFullYear();
      if (year < 1970 || year > currentYear + 1) {
        throw new Error('Year of passing must be between 1970 and current year');
      }
      return true;
    }),

  body('educationalQualifications.*.marksPercentage')
    .trim()
    .notEmpty()
    .withMessage('Marks/Percentage is required')
    .isLength({ max: 10 })
    .withMessage('Marks/Percentage cannot exceed 10 characters'),



  // Qualifying Degree
  body('qualifyingDegree')
    .isIn(['B.Sc/B.Tech/B.E/BCA', 'M.Sc/M.Tech/M.E/MA/MCA', 'Others'])
    .withMessage('Invalid qualifying degree selected'),

  body('qualifyingDegreeOther')
    .optional()
    .trim()
    .custom((value, { req }) => {
      if (req.body.qualifyingDegree === 'Others') {
        if (!value || value.trim().length === 0) {
          throw new Error('Please specify other qualifying degree when Others is selected');
        }
        if (value.length > 200) {
          throw new Error('Other degree cannot exceed 200 characters');
        }
      }
      return true;
    }),

  body('degreeMajorSpecialization')
    .trim()
    .notEmpty()
    .withMessage('Degree specialization is required')
    .isLength({ max: 200 })
    .withMessage('Specialization cannot exceed 200 characters'),

  // Publication Details (Optional)
  body('publicationDetails')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Publication details cannot exceed 5000 characters'),

  // NEW VALIDATION: Declaration Agreement
  body('declarationAgreed')
    .custom((value) => {
      if (value !== 'true' && value !== true) {
        throw new Error('You must agree to the declaration to proceed');
      }
      return true;
    }),

  // Application Declaration
  body('applicationDate')
    .isISO8601()
    .withMessage('Invalid application date format'),

  body('applicationPlace')
    .trim()
    .notEmpty()
    .withMessage('Application place is required')
    .isLength({ max: 100 })
    .withMessage('Place name cannot exceed 100 characters'),

  body('nameDeclaration')
    .trim()
    .notEmpty()
    .withMessage('Name declaration is required')
    .isLength({ max: 100 })
    .withMessage('Name declaration cannot exceed 100 characters')
    .matches(/^[a-zA-Z\s.]+$/)
    .withMessage('Name declaration should contain only letters, spaces, and dots')
];

// Validation for status update
const validateStatusUpdate = [
  body('status')
    .isIn(['submitted', 'under_review', 'approved', 'rejected'])
    .withMessage('Invalid status value')
];

// Custom validation middleware to handle array validation
const validateEducationalQualifications = (req, res, next) => {
  const { educationalQualifications } = req.body;

  // Parse if it's a string (from FormData)
  let qualifications;
  try {
    qualifications = typeof educationalQualifications === 'string'
      ? JSON.parse(educationalQualifications)
      : educationalQualifications;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid educational qualifications format',
      errors: [{ field: 'educationalQualifications', message: 'Invalid JSON format' }]
    });
  }

  if (!Array.isArray(qualifications) || qualifications.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one educational qualification is required',
      errors: [{ field: 'educationalQualifications', message: 'At least one qualification is required' }]
    });
  }

  // Validate each qualification
  for (let i = 0; i < qualifications.length; i++) {
    const qual = qualifications[i];
    const errors = [];

    if (!qual.institute || !qual.institute.trim()) {
      errors.push({ field: `educationalQualifications[${i}].institute`, message: 'Institute name is required' });
    }

    if (!qual.examPassed) {
      errors.push({ field: `educationalQualifications[${i}].examPassed`, message: 'Exam passed is required' });
    }
    // Add this after the examPassed validation:
    if (qual.examPassed === 'Others' && (!qual.examPassedOther || !qual.examPassedOther.trim())) {
      errors.push({ field: `educationalQualifications[${i}].examPassedOther`, message: 'Please specify other exam when Others is selected' });
    }
    // NEW VALIDATION: Name of Examination
    if (!qual.nameOfExamination || !qual.nameOfExamination.trim()) {
      errors.push({ field: `educationalQualifications[${i}].nameOfExamination`, message: 'Name of examination is required' });
    }

    if (!qual.yearOfPassing || !qual.yearOfPassing.trim()) {
      errors.push({ field: `educationalQualifications[${i}].yearOfPassing`, message: 'Year of passing is required' });
    }

    if (!qual.marksPercentage || !qual.marksPercentage.trim()) {
      errors.push({ field: `educationalQualifications[${i}].marksPercentage`, message: 'Marks/Percentage is required' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Educational qualification validation failed',
        errors
      });
    }
  }

  // Update the request body with parsed qualifications
  req.body.educationalQualifications = qualifications;

  next();
};

// Custom validation middleware for experience
const validateExperience = (req, res, next) => {
  const { experience } = req.body;

  // Parse if it's a string (from FormData)
  let experiences;
  try {
    experiences = typeof experience === 'string'
      ? JSON.parse(experience)
      : experience;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'Invalid experience format',
      errors: [{ field: 'experience', message: 'Invalid JSON format' }]
    });
  }

  if (!Array.isArray(experiences) || experiences.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'At least one work experience is required',
      errors: [{ field: 'experience', message: 'At least one work experience is required' }]
    });
  }

  // Validate each experience
  for (let i = 0; i < experiences.length; i++) {
    const exp = experiences[i];
    const errors = [];

    if (!exp.companyName || !exp.companyName.trim()) {
      errors.push({ field: `experience[${i}].companyName`, message: 'Company name is required' });
    }

    if (!exp.startDate) {
      errors.push({ field: `experience[${i}].startDate`, message: 'Start date is required' });
    }

    // Convert string boolean to boolean if needed
    if (typeof exp.isCurrentlyWorking === 'string') {
      exp.isCurrentlyWorking = exp.isCurrentlyWorking === 'true';
    }

    if (!exp.isCurrentlyWorking && !exp.endDate) {
      errors.push({ field: `experience[${i}].endDate`, message: 'End date is required when not currently working' });
    }

    if (!exp.salary || !exp.salary.trim()) {
      errors.push({ field: `experience[${i}].salary`, message: 'Salary is required' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Experience validation failed',
        errors
      });
    }
  }

  // Update the request body with parsed experiences
  req.body.experience = experiences;

  next();
};

module.exports = {
  validateApplicationSubmission,
  validateStatusUpdate,
  validateEducationalQualifications,
  validateExperience
};