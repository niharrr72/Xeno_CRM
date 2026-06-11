export class ApiError extends Error {
  constructor(status, message, code = 'API_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(req, res) {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  console.error(`${new Date().toISOString()} ERROR`, { code, message: err.message, stack: err.stack });
  res.status(status).json({
    success: false,
    error: status === 500 ? 'Internal server error' : err.message,
    code
  });
}
