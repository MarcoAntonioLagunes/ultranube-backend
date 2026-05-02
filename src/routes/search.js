// src/routes/search.js
import express from 'express';
import authMiddleware from '../middleware/auth.js';
import { searchItems } from '../controllers/searchController.js';

const router = express.Router();

// GET /api/search?q=texto
router.get('/', authMiddleware, searchItems);

export default router;
