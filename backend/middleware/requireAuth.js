const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    }

    const [rows] = await db.query(
      'SELECT user_id, student_id, full_name, email, role, account_status FROM users WHERE user_id = ?',
      [payload.userId]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Account not found.' });
    }
    if (user.account_status !== 'Active') {
      return res.status(403).json({ error: 'Your account is not active.' });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
