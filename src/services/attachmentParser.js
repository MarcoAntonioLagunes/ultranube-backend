import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const MAX_TEXT_LENGTH = 12000;

function truncateText(text, limit = MAX_TEXT_LENGTH) {
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, limit)}\n\n...[texto truncado]`;
}

function normalizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/\r\n/g, '\n')
    .trim();
}

export async function extractTextFromFile(filePath, mimeType) {
  if (!filePath) {
    return {
      text: null,
      warning: 'El archivo no tiene ruta local disponible.',
    };
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
  let buffer;
  try {
    buffer = await fs.readFile(absolutePath);
  } catch (err) {
    return {
      text: null,
      warning: `No se pudo leer el archivo adjunto: ${err.message}`,
    };
  }

  const ext = path.extname(absolutePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      const data = await pdfParse(buffer);
      return {
        text: truncateText(normalizeText(data.text)),
        warning: null,
      };
    }

    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      return {
        text: truncateText(normalizeText(result.value)),
        warning: null,
      };
    }

    if (['.txt', '.md', '.json', '.csv', '.log', '.html', '.htm'].includes(ext)) {
      const raw = buffer.toString('utf-8');
      return {
        text: truncateText(normalizeText(raw)),
        warning: null,
      };
    }

    return {
      text: null,
      warning: `Tipo de archivo no compatible para lectura automática (${ext}).`,
    };
  } catch (err) {
    return {
      text: null,
      warning: `Error al extraer el contenido del archivo: ${err.message}`,
    };
  }
}

export function buildAttachmentPrompt(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const lines = attachments.map((attachment) => {
    if (!attachment) return null;
    const title = attachment.name || attachment.originalName || attachment.fileName || 'Archivo adjunto';
    if (attachment.text) {
      return `- ${title}: ${attachment.text}`;
    }
    if (attachment.warning) {
      return `- ${title}: ${attachment.warning}`;
    }
    return `- ${title}: no se pudo obtener el contenido completo.`;
  }).filter(Boolean);

  if (!lines.length) return '';

  return `\n\nArchivos adjuntos:\n${lines.join('\n')}\n\nPor favor, utiliza esta información para responder y generar un resumen cuando corresponda.`;
}
