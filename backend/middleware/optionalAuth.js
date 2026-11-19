const jwt = require('jsonwebtoken');
const db = require('../config/db');

module.exports = async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return next();

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return next();
    }

    const [rows] = await db.query(
      'SELECT user_id, student_id, full_name, email, role, account_status FROM users WHERE user_id = ?',
      [payload.userId]
    );
    const user = rows[0];
    if (user && user.account_status === 'Active') {
      req.user = user;
    }
    return next();
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    return next();
  }
};
