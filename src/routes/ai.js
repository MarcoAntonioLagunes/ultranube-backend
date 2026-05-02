// src/routes/ai.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { chatWithAI, proxyAnthropicCall } from '../controllers/aiController.js';

const router = express.Router();

// POST /api/ai/chat
router.post('/chat', authMiddleware, chatWithAI);

// POST /api/ai/proxy  — reenvía llamadas a Anthropic desde el frontend
router.post('/proxy', authMiddleware, proxyAnthropicCall);

export default router;