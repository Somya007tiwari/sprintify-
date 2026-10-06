const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads folder exists on startup
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.txt', '.log', '.csv', '.json'];
const ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/x-log',
  'text/csv',
  'application/csv',
  'application/json',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIMES.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed types: PNG, JPG, WEBP, GIF, PDF, TXT, LOG, CSV, JSON.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter,
});

module.exports = upload;
