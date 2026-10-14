import multer from 'multer';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';

const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream', // some browsers/OSes send this for .docx
  '',
]);

/** In-memory upload: nothing is written to disk, so there is nothing to clean up. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxUploadBytes, files: 1, fields: 10, fieldSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const name = String(file.originalname || '').toLowerCase();
    if (!name.endsWith('.docx')) {
      return cb(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Only .docx files are supported.'));
    }
    if (!DOCX_MIMES.has(file.mimetype)) {
      return cb(new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'Only .docx files are supported.'));
    }
    cb(null, true);
  },
});

export const uploadDocx = upload.single('file');

export function requireFile(req, _res, next) {
  if (!req.file || !req.file.buffer?.length) {
    return next(new AppError(400, 'NO_FILE', 'Please attach a .docx file.'));
  }
  next();
}
