export function errorHandler(err, req, res, next) {
  console.error('[API Error]', req.method, req.originalUrl, err);

  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Terjadi kesalahan internal pada server.';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
