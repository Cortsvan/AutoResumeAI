import { AppError } from '../utils/errors.js';

/** Final error handler. Never leaks stack traces or document content. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.publicMessage, details: err.details },
    });
  }

  // multer
  if (err && err.name === 'MulterError') {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      error: {
        code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR',
        message: tooBig ? 'That file is larger than the allowed upload size.' : 'The upload could not be processed.',
      },
    });
  }

  // body-parser
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'The request is too large.' } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } });
  }

  // Log only the error name/message, never request bodies.
  console.error('[server] Unhandled error:', err?.name || 'Error', err?.message || '');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' } });
}

export function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
}
