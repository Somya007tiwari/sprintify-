const multer = require('multer');

function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum allowed file size is 5 MB.' });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file upload field or too many files.' });
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
