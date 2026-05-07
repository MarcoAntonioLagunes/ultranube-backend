// src/routes/filesRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import authMiddleware from '../middleware/auth.js';
import {
  uploadFile,
  renameFile,
  deleteFile,
  getRecentFiles,
  downloadFile,
  moveFile,
  getAllFiles,
} from '../controllers/filesController.js';

const router = express.Router();

// ── Multer config ──────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  // Imágenes
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/markdown', 'text/csv',
  // Audio / Video
  'audio/mpeg', 'audio/wav', 'audio/flac',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  // Comprimidos
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Solo PDFs')),
});

// ── Middleware de error de multer ──────────────────────────────────────────────
function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'El archivo excede el límite de 50 MB.' });
    }
    return res.status(400).json({ message: `Error al subir: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
}

// ── Rutas ──────────────────────────────────────────────────────────────────────
router.use(authMiddleware);

// POST /extract-pdf-text — extract plain text from a PDF via pdf-parse (Node.js)
// Better encoding handling than pdfjs in the browser for fonts with custom ToUnicode maps.
router.post(
  '/extract-pdf-text',
  memUpload.single('pdf'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se envió PDF' });
      const result = await pdfParse(req.file.buffer);
      // pdf-parse uses \f (form feed) as page separator
      const pages = result.text
        .split('\f')
        .map(p => p.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean);
      return res.json({ text: result.text, pages });
    } catch (err) {
      console.error('extract-pdf-text error:', err);
      return res.status(500).json({ message: `Error al extraer texto: ${err.message}` });
    }
  }
);

router.post('/upload', upload.single('file'), handleMulterError, uploadFile);
router.get('/all', getAllFiles);
router.get('/recent/list', getRecentFiles);
router.get('/:id/download', downloadFile);
router.patch('/:id/move', moveFile);
router.patch('/:id', renameFile);
router.delete('/:id', deleteFile);

export default router;
