// src/routes/filesRoutes.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const execFileAsync = promisify(execFile);
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

function qualityOk(text, numPages) {
  const pages = toPages(text);
  const total = pages.reduce((s, p) => s + p.length, 0);
  const avg   = total / Math.max(numPages || pages.length, 1);
  return total >= 50 && avg >= 50 && !isGarbled(text)
    ? pages
    : null;
}

function toPages(rawText) {
  return rawText
    .split('\f')
    .map(p => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);
}

// ── Method 1: pdftotext (poppler) — best encoding support ────────────────────
// Handles Type1, CIDFont, and most ToUnicode maps correctly.
// Requires poppler-utils installed (nixpacks.toml on Railway, bundled with Git on Windows).
async function extractWithPdftotext(buffer) {
  const tmpFile = path.join(os.tmpdir(), `ultranube-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
  try {
    await fs.promises.writeFile(tmpFile, buffer);
    const { stdout } = await execFileAsync('pdftotext', ['-enc', 'UTF-8', tmpFile, '-'], {
      maxBuffer: 20 * 1024 * 1024,
    });
    return stdout;
  } finally {
    fs.promises.unlink(tmpFile).catch(() => {});
  }
}

// ── Method 2: pdf-parse (Node) ────────────────────────────────────────────────
async function extractWithPdfParse(buffer) {
  const result = await pdfParse(buffer);
  return { text: result.text, numpages: result.numpages };
}

// ── Method 3: Claude API (vision/document) — works on any PDF, incl. scanned ─
// Sends the PDF as a base64 document to Claude and asks for plain-text extraction.
// Last resort: costs tokens but handles fonts that all other methods fail on.
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';
const EXTRACT_MODEL  = 'claude-sonnet-4-6';
const MAX_PDF_CLAUDE = 20 * 1024 * 1024; // 20 MB — stay within Claude's doc limits

async function extractWithClaude(buffer) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  if (buffer.length > MAX_PDF_CLAUDE) throw new Error('PDF too large for Claude extraction (>20 MB)');

  const base64 = buffer.toString('base64');

  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          {
            type: 'text',
            text:
              'Extract ALL the text from this PDF exactly as written. ' +
              'Preserve paragraph structure using line breaks. ' +
              'Separate each page with the exact string "\\f" (a single form-feed character). ' +
              'Return ONLY the extracted text — no commentary, no markdown, no explanations.',
          },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${resp.status}`);
  }

  const data = await resp.json();
  return data.content[0].text;
}

// ── Method 4: OCR — pdftoppm (poppler) → page images → Claude vision ────────
// pdftoppm is bundled inside poppler_utils (already in nixpacks.toml).
// Converts each page to a PNG at 150 DPI, then sends all images to Claude
// vision in a single request. Handles any font encoding and scanned PDFs.
const MAX_OCR_PAGES = 20; // stay within Claude's context limits

async function extractWithOcrClaude(buffer) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const tmpDir = path.join(os.tmpdir(), `ultranube-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const tmpPdf = path.join(tmpDir, 'input.pdf');

  await fs.promises.mkdir(tmpDir, { recursive: true });
  await fs.promises.writeFile(tmpPdf, buffer);

  try {
    // Render pages to PNG at 150 DPI — good enough for text, keeps images small
    await execFileAsync(
      'pdftoppm',
      ['-r', '150', '-png', tmpPdf, path.join(tmpDir, 'page')],
      { maxBuffer: 200 * 1024 * 1024 }
    );

    const pageFiles = (await fs.promises.readdir(tmpDir))
      .filter(f => /^page.*\.png$/i.test(f))
      .sort((a, b) => {
        const n = s => parseInt(s.match(/(\d+)\.png$/i)?.[1] ?? '0', 10);
        return n(a) - n(b);
      })
      .slice(0, MAX_OCR_PAGES);

    if (pageFiles.length === 0) throw new Error('pdftoppm produced no images');

    // Build Claude message: interleave image blocks with page labels
    const content = [];
    for (let i = 0; i < pageFiles.length; i++) {
      const imgBuf = await fs.promises.readFile(path.join(tmpDir, pageFiles[i]));
      content.push({
        type: 'text',
        text: `[Página ${i + 1}]`,
      });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: imgBuf.toString('base64') },
      });
    }
    content.push({
      type: 'text',
      text:
        'Extract ALL the text visible in these PDF page images, in the same language as the original. ' +
        'Preserve paragraph structure with line breaks. ' +
        'Separate pages with a single form-feed character \\f. ' +
        'Return ONLY the extracted text — no commentary, no markdown.',
    });

    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Anthropic vision error ${resp.status}`);
    }

    const data = await resp.json();
    return data.content[0].text;
  } finally {
    fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// POST /extract-pdf-text
// Cascade: pdftotext → pdf-parse → Claude (doc) → Claude vision OCR → 422
router.post(
  '/extract-pdf-text',
  memUpload.single('pdf'),
  handleMulterError,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No se envió PDF' });
      const buffer = req.file.buffer;

      // ── 1. pdftotext (poppler) ────────────────────────────────────────────
      let pages = null;
      try {
        const text = await extractWithPdftotext(buffer);
        pages = qualityOk(text, 0);
        if (pages) return res.json({ pages });
      } catch (e) {
        if (e.code !== 'ENOENT') console.warn('pdftotext failed:', e.message);
      }

      // ── 2. pdf-parse ──────────────────────────────────────────────────────
      try {
        const { text, numpages } = await extractWithPdfParse(buffer);
        pages = qualityOk(text, numpages);
        if (pages) return res.json({ pages });
      } catch (e) {
        console.warn('pdf-parse failed:', e.message);
      }

      // ── 3. Claude API — PDF document (native) ─────────────────────────────
      try {
        const text  = await extractWithClaude(buffer);
        const pgArr = toPages(text);
        if (pgArr.length > 0 && pgArr.reduce((s, p) => s + p.length, 0) >= 50) {
          return res.json({ pages: pgArr });
        }
      } catch (e) {
        console.warn('Claude doc extraction failed:', e.message);
      }

      // ── 4. Claude vision OCR (pdftoppm → images) ──────────────────────────
      try {
        const text  = await extractWithOcrClaude(buffer);
        const pgArr = toPages(text);
        if (pgArr.length > 0 && pgArr.reduce((s, p) => s + p.length, 0) >= 50) {
          return res.json({ pages: pgArr });
        }
      } catch (e) {
        if (e.code !== 'ENOENT') console.warn('Claude OCR failed:', e.message);
      }

      return res.status(422).json({ message: INCOMPATIBLE_MSG });
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
