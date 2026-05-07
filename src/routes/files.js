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

const INCOMPATIBLE_MSG =
  'Este PDF no es compatible con el traductor — contiene imágenes o fuentes no estándar ' +
  'que no se pueden extraer. Por favor usa un PDF con texto seleccionable.';

// >40% of words are 1-2 chars → likely garbled per-glyph output ("n a n a n c e")
function isGarbled(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 15) return false;
  const short = words.filter(w => w.length <= 2).length;
  return short / words.length > 0.40;
}

function toPages(rawText) {
  return rawText
    .split('\f')
    .map(p => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

// Extract text with pdfjs-dist (legacy/Node build) — handles more font types than pdf-parse
async function extractWithPdfjs(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // Disable the Web Worker — not available in Node.js
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch:   false,
    isEvalSupported:  false,
    useSystemFonts:   true,
    standardFontDataUrl: null,
  }).promise;

  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page    = await doc.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: true, disableFontFace: true });
    let pageText  = '';
    for (const item of content.items) {
      if (!item.str) continue;
      pageText += item.str;
      if (item.hasEOL) pageText += '\n';
    }
    fullText += pageText.replace(/[ \t]+/g, ' ').trim() + '\f';
  }
  return { text: fullText, numpages: doc.numPages };
}

// POST /extract-pdf-text — tries pdf-parse first, falls back to pdfjs-dist if garbled
router.post(
  '/extract-pdf-text',
  memUpload.single('pdf'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se envió PDF' });
      const buffer = req.file.buffer;

      // ── Method 1: pdf-parse ───────────────────────────────────────────────
      let chosen = null;
      try {
        const result = await pdfParse(buffer);
        const pages  = toPages(result.text);
        const total  = pages.reduce((s, p) => s + p.length, 0);
        const avg    = total / Math.max(result.numpages || pages.length, 1);
        if (total >= 50 && avg >= 50 && !isGarbled(result.text)) {
          chosen = { text: result.text, pages };
        }
      } catch { /* fall through to pdfjs */ }

      // ── Method 2: pdfjs-dist (Node, legacy build) ─────────────────────────
      if (!chosen) {
        try {
          const result = await extractWithPdfjs(buffer);
          const pages  = toPages(result.text);
          const total  = pages.reduce((s, p) => s + p.length, 0);
          const avg    = total / Math.max(result.numpages || pages.length, 1);
          if (total >= 50 && avg >= 50 && !isGarbled(result.text)) {
            chosen = { text: result.text, pages };
          }
        } catch (e) {
          console.warn('pdfjs fallback failed:', e.message);
        }
      }

      if (!chosen) {
        return res.status(422).json({ message: INCOMPATIBLE_MSG });
      }

      return res.json({ text: chosen.text, pages: chosen.pages });
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
