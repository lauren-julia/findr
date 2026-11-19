const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'lost-found');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    cb(null, `lf-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error('Only JPEG and PNG images are allowed.'));
    }
    return cb(null, true);
  }
});

module.exports = function uploadLostFoundImage(req, res, next) {
  return upload.single('image')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image must be 5 MB or smaller.' });
    }
    return res.status(400).json({ error: err.message || 'Invalid image upload.' });
  });
};
