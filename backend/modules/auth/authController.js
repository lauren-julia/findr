const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../utils/mailer');

exports.registerStudent = async (req, res) => {
  try {
    const { student_id, full_name, password } = req.body;

    if (!student_id || !full_name || !password) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }

    if (!/^\d+$/.test(student_id.trim())) {
      return res.status(400).json({ error: "Invalid Student ID format." });
    }

    const institutionalEmail = `${student_id.trim()}@usc.edu.ph`;

    const [existingUsers] = await db.query(
      'SELECT * FROM users WHERE student_id = ? OR email = ?',
      [student_id.trim(), institutionalEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "An account with this Student ID or email already exists." });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [result] = await db.query(
      `INSERT INTO users (student_id, full_name, email, password_hash, role, account_status, verification_token, token_expires_at) 
       VALUES (?, ?, ?, ?, 'Student', 'Inactive', ?, ?)`,
      [student_id.trim(), full_name.trim(), institutionalEmail, passwordHash, verificationToken, tokenExpiresAt]
    );

    try {
      await sendVerificationEmail(institutionalEmail, full_name.trim(), verificationToken);
    } catch (emailError) {
      console.error("Email dispatch failed:", emailError);
    }

    return res.status(201).json({
      success: true,
      message: "Registration successful! Please check your email to verify your account.",
      userId: result.insertId
    });

  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ error: "Internal server error during registration." });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send("Verification token is missing.");
    }

    const [users] = await db.query(
      'SELECT * FROM users WHERE verification_token = ? AND token_expires_at > NOW()',
      [token]
    );

    if (users.length === 0) {
      return res.status(400).send("Invalid or expired verification token.");
    }

    await db.query(
      'UPDATE users SET account_status = "Active", verification_token = NULL, token_expires_at = NULL WHERE verification_token = ?',
      [token]
    );

    const frontendBase = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
    const loginUrl = `${frontendBase}/#/login?verified=1&studentId=${encodeURIComponent(users[0].student_id)}`;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Email Verified · Findr</title>
          <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        </head>
        <body style="margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; background-color: #faf9f6; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; box-sizing: border-box;">
          <div style="width: 100%; max-width: 460px; background-color: #ffffff; border: 1px solid #eae7e2; border-radius: 15px; overflow: hidden; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #006b22; padding: 20px 28px; display: flex; align-items: center; justify-content: space-between;">
              <div>
                <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">Findr.</span>
                <span style="display: block; font-size: 11px; color: #d1fae5; margin-top: 2px;">USC DCISM</span>
              </div>
              <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; background-color: rgba(255,255,255,0.16); color: #ffffff; font-size: 11px; font-weight: 700;">Verified</span>
            </div>
            <div style="padding: 32px 28px; text-align: center;">
              <div style="width: 52px; height: 52px; margin: 0 auto 16px; border-radius: 50%; background-color: #eaf5ec; color: #006b22; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800;">
                &#10003;
              </div>
              <h1 style="margin: 0 0 10px; font-size: 22px; font-weight: 800; color: #111827;">You've been verified!</h1>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #4b5563;">
                Your Findr account is now active. Click below to log in with your Student ID.
              </p>
              <a href="${loginUrl}" style="display: inline-block; background-color: #006b22; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 9px; font-size: 14px; font-weight: 700;">
                Log In
              </a>
            </div>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error("Verification error:", error);
    return res.status(500).send("Internal server error during verification.");
  }
};

exports.loginStudent = async (req, res) => {
  try {
    const { studentId, password, rememberMe } = req.body;

    if (!studentId || !password) {
      return res.status(400).json({ error: "Please enter your Student ID and password." });
    }

    const trimmedStudentId = studentId.trim();

    const [users] = await db.query(
      'SELECT * FROM users WHERE student_id = ?',
      [trimmedStudentId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid Student ID or password." });
    }

    const user = users[0];

    if (user.account_status === 'Suspended') {
      return res.status(403).json({ error: "Your account has been suspended. Please contact an administrator." });
    }
    if (user.account_status !== 'Active') {
      return res.status(403).json({ error: "Please verify your email address before logging in." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid Student ID or password." });
    }

    const persistLogin = Boolean(rememberMe);
    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: persistLogin ? '30d' : '1d' }
    );

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    };
    if (persistLogin) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
    }

    res.cookie('token', token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      user: {
        user_id: user.user_id,
        student_id: user.student_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error during login." });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully from server."
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ error: "Internal server error during logout." });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { studentId } = req.body;
    const trimmedStudentId = studentId ? String(studentId).trim() : '';

    if (!trimmedStudentId || !/^\d+$/.test(trimmedStudentId)) {
      return res.status(400).json({ error: "Please enter a valid numeric Student ID." });
    }

    const [users] = await db.query(
      'SELECT user_id, full_name, email, account_status FROM users WHERE student_id = ?',
      [trimmedStudentId]
    );

    if (users.length > 0 && users[0].account_status === 'Active') {
      const user = users[0];
      const resetToken = crypto.randomBytes(32).toString('hex');

      await db.query(
        'UPDATE users SET verification_token = ?, token_expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE user_id = ?',
        [resetToken, user.user_id]
      );

      try {
        await sendPasswordResetEmail(user.email, user.full_name, resetToken);
      } catch (mailError) {
        console.error("Password reset email dispatch failed:", mailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "If an active account exists for that Student ID, a password reset link has been sent to its USC email."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Reset token and new password are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const [users] = await db.query(
      "SELECT user_id, student_id FROM users WHERE verification_token = ? AND token_expires_at > NOW() AND account_status = 'Active'",
      [token]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: "Invalid or expired password reset link." });
    }

    const user = users[0];
    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      'UPDATE users SET password_hash = ?, verification_token = NULL, token_expires_at = NULL WHERE user_id = ?',
      [passwordHash, user.user_id]
    );

    return res.status(200).json({
      success: true,
      studentId: user.student_id,
      message: "Password updated! Please log in."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
};