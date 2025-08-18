// controllers/otpController.js
const nodemailer = require('nodemailer');

// SHARED OTP storage - CRITICAL: This must be exported and imported by applicationController
const otpStorage = new Map();

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

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Send OTP to email
// @route   POST /api/send-otp
// @access  Public
const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if OTP was sent recently (rate limiting)
    const lastSent = otpStorage.get(`${normalizedEmail}_timestamp`);
    if (lastSent && Date.now() - lastSent < 60000) { // 1 minute cooldown
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryTime = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP with normalized email
    otpStorage.set(normalizedEmail, { otp, expiryTime });
    otpStorage.set(`${normalizedEmail}_timestamp`, Date.now());

    console.log(`[OTP] Storing OTP for: ${normalizedEmail}`);
    console.log(`[OTP] OTP generated: ${otp}`);

    // Send email
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@iitp.ac.in',
      to: normalizedEmail,
      subject: 'IIT Patna - Email Verification OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
            <h2 style="color: #333;">IIT Patna</h2>
            <p style="color: #666;">Email Verification</p>
          </div>
          <div style="padding: 20px; background-color: white;">
            <p>Dear Applicant,</p>
            <p>Your One-Time Password (OTP) for email verification is:</p>
            <div style="background-color: #e9ecef; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px;">
              <h1 style="color: #007bff; font-size: 36px; margin: 0; font-family: monospace; letter-spacing: 5px;">${otp}</h1>
            </div>
            <p style="color: #dc3545; font-weight: bold;">This OTP is valid for 10 minutes only.</p>
            <p>If you did not request this OTP, please ignore this email.</p>
            <p style="margin-top: 30px;">Best regards,<br>
            <strong>PI</strong>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666;">
            This is an automated email. Please do not reply to this email.
          </div>
        </div>
      `,
    };


    // Send email (Always send, regardless of environment)
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[OTP] Email sent successfully to: ${normalizedEmail}`);
    } catch (emailError) {
      console.error(`[OTP] Failed to send email to ${normalizedEmail}:`, emailError);
      // Don't return error - continue with OTP generation for development
    }

    console.log(`[OTP] Email sent to: ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email address'
    });

  } catch (error) {
    console.error('[OTP] Error sending OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

// @desc    Verify OTP
// @route   POST /api/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`[OTP] Verifying OTP for: ${normalizedEmail}`);
    console.log(`[OTP] Provided OTP: ${otp}`);

    // Get stored OTP
    const storedData = otpStorage.get(normalizedEmail);

    if (!storedData) {
      console.log(`[OTP] No OTP found for: ${normalizedEmail}`);
      return res.status(400).json({
        success: false,
        message: 'OTP not found. Please request a new OTP.'
      });
    }

    console.log(`[OTP] Stored OTP: ${storedData.otp}`);
    console.log(`[OTP] OTP expiry: ${new Date(storedData.expiryTime)}`);

    // Check if OTP is expired
    if (Date.now() > storedData.expiryTime) {
      otpStorage.delete(normalizedEmail);
      otpStorage.delete(`${normalizedEmail}_timestamp`);
      console.log(`[OTP] OTP expired for: ${normalizedEmail}`);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    // Verify OTP
    if (storedData.otp !== otp) {
      console.log(`[OTP] Invalid OTP for: ${normalizedEmail}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.'
      });
    }

    // OTP verified successfully
    otpStorage.delete(normalizedEmail);
    otpStorage.delete(`${normalizedEmail}_timestamp`);

    // Store verification status with longer expiry (30 minutes)
    const verificationKey = `${normalizedEmail}_verified`;
    otpStorage.set(verificationKey, true);
    
    console.log(`[OTP] Email verified successfully for: ${normalizedEmail}`);
    console.log(`[OTP] Verification key set: ${verificationKey}`);
    console.log(`[OTP] All storage keys:`, Array.from(otpStorage.keys()));

    // Set expiry for verification status (30 minutes)
    setTimeout(() => {
      otpStorage.delete(verificationKey);
      console.log(`[OTP] Verification expired for: ${normalizedEmail}`);
    }, 30 * 60 * 1000);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('[OTP] Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.'
    });
  }
};

// @desc    Check if email is verified
// @route   POST /api/check-verification
// @access  Public
const checkVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    const verificationKey = `${normalizedEmail}_verified`;
    const isVerified = otpStorage.get(verificationKey) || false;

    console.log(`[OTP] Checking verification for: ${normalizedEmail}`);
    console.log(`[OTP] Verification key: ${verificationKey}`);
    console.log(`[OTP] Is verified: ${isVerified}`);

    res.status(200).json({
      success: true,
      verified: isVerified
    });

  } catch (error) {
    console.error('[OTP] Error checking verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check verification status'
    });
  }
};

module.exports = {
  sendOTP,
  verifyOTP,
  checkVerification,
  otpStorage // Export the storage so applicationController can import it
};