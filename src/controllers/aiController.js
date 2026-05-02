// src/controllers/aiController.js
import { askAI } from '../services/aiService.js';
import { extractTextFromFile, buildAttachmentPrompt } from '../services/attachmentParser.js';
import File from '../models/File.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

export async function proxyAnthropicCall(req, res) {
  const { system, messages, maxTokens = 4096 } = req.body;

  if (!system || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ ok: false, message: 'Faltan campos: system, messages' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ ok: false, message: 'ANTHROPIC_API_KEY no configurada en el servidor' });
  }

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `Error ${response.status} de Anthropic`;
      return res.status(response.status).json({ ok: false, message: msg });
    }

    const data = await response.json();
    return res.json({ ok: true, text: data.content[0].text });
  } catch (error) {
    console.error('proxyAnthropicCall error:', error);
    return res.status(500).json({ ok: false, message: error.message || 'Error al contactar Anthropic' });
  }
}

const MAX_MESSAGE_LENGTH = 4000;

export async function chatWithAI(req, res) {
  try {
    const { message, attachments = [] } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ ok: false, message: 'El mensaje es obligatorio' });
    }

    if (String(message).trim().length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ ok: false, message: 'El mensaje es demasiado largo (máx. 4000 caracteres)' });
    }

    // Enrich attachments with extracted file text
    const enrichedAttachments = await Promise.all(
      (Array.isArray(attachments) ? attachments : []).map(async (att) => {
        if (!att?.id) {
          return { name: att?.name || 'Archivo', text: null, warning: 'Sin referencia de archivo.' };
        }

        const fileDoc = await File.findOne({ _id: att.id, owner: req.userId }).lean();
        if (!fileDoc) {
          return { name: att.name || 'Archivo', text: null, warning: 'Archivo no encontrado en el servidor.' };
        }

        const { text, warning } = await extractTextFromFile(fileDoc.path, fileDoc.mimeType);
        return { name: fileDoc.originalName, text, warning };
      })
    );

    const attachmentText = buildAttachmentPrompt(enrichedAttachments);
    const fullMessage = `${String(message).trim()}${attachmentText}`;

    const reply = await askAI(fullMessage);

    return res.status(200).json({ ok: true, reply });
  } catch (error) {
    console.error('chatWithAI error:', error);
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Error al procesar la solicitud con la IA',
    });
  }
}
