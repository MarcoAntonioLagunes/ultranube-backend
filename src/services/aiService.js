// src/services/aiService.js
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || !String(apiKey).trim()) {
    throw new Error('Falta configurar OPENAI_API_KEY en el archivo .env');
  }

  return new OpenAI({
    apiKey: String(apiKey).trim(),
  });
}

export async function askAI(message) {
  const cleanMessage = String(message || '').trim();

  if (!cleanMessage) {
    throw new Error('El mensaje está vacío');
  }

  const attachmentText = '';

  try {
    const client = getOpenAIClient();

    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Eres el asistente IA de UltraNube. Responde en español, de forma clara, útil y natural.',
        },
        {
          role: 'user',
          content: `${cleanMessage}${attachmentText}`,
        },
      ],
      max_tokens: 700,
    });

    const reply =
      response.choices?.[0]?.message?.content?.trim() ||
      'No pude generar una respuesta en este momento.';

    return reply;
  } catch (error) {
    console.error('askAI error completo:', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      param: error?.param,
    });

    if (error?.status) {
      throw new Error(
        `OpenAI error ${error.status}: ${error?.message || 'Error desconocido'}`
      );
    }

    throw error;
  }
}