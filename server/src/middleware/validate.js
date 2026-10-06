const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    if (err.errors && err.errors.length > 0) {
      const errorMessage = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: errorMessage });
    }
    return res.status(400).json({ error: err.message || 'Validation error' });
  }
};

module.exports = validate;
