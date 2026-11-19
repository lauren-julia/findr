const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'marketplace');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXT.has(ext) ? ext : '.jpg';
    cb(null, `mk-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error('Only JPEG and PNG images are allowed.'));
    }
    return cb(null, true);
  }
});

function detectImageType(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, header, 0, 8, 0);
    if (bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'jpg';
    }
    if (bytesRead === 8 && header.equals(PNG_SIGNATURE)) {
      return 'png';
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function discard(file) {
  if (file?.path) fs.promises.unlink(file.path).catch(() => {});
}

module.exports = function uploadMarketplaceImage(req, res, next) {
  return upload.single('image')(req, res, (err) => {
    if (err) {
      discard(req.file);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Image must be 2 MB or smaller.' });
      }
      return res.status(400).json({ error: err.message || 'Invalid image upload.' });
    }

    if (req.file) {
      const type = detectImageType(req.file.path);
      if (!type) {
        discard(req.file);
        return res.status(400).json({ error: 'The uploaded file is not a valid JPEG or PNG image.' });
      }

      const currentExt = path.extname(req.file.filename).toLowerCase();
      const wantedExt = type === 'png' ? '.png' : '.jpg';
      if ((type === 'png') !== (currentExt === '.png')) {
        const newName = req.file.filename.slice(0, -currentExt.length) + wantedExt;
        const newPath = path.join(UPLOAD_DIR, newName);
        try {
          fs.renameSync(req.file.path, newPath);
          req.file.filename = newName;
          req.file.path = newPath;
        } catch {
          discard(req.file);
          return res.status(500).json({ error: 'Failed to process the uploaded image.' });
        }
      }
    }

    return next();
  });
};
