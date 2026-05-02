// src/routes/driveRoutes.js
import express from 'express';

// 🔧 IMPORTS CORREGIDOS (antes estaban con ./middleware y ./controllers)
import authMiddleware from '../middleware/auth.js';
import {
  getItemsInFolder,
  createFolder,
  renameFolder,
  deleteFolder,
  searchItems,
} from '../controllers/driveController.js';

const router = express.Router();

// Todas las rutas de drive requieren estar autenticado
router.use(authMiddleware);

// Lista de elementos de una carpeta
// GET /api/drive/items?folderId=<id>
router.get('/items', getItemsInFolder);

// Crear carpeta
// POST /api/drive/folders
router.post('/folders', createFolder);

// Renombrar carpeta
// PATCH /api/drive/folders/:id
router.patch('/folders/:id', renameFolder);

// Eliminar carpeta
// DELETE /api/drive/folders/:id
router.delete('/folders/:id', deleteFolder);

// Búsqueda GLOBAL (carpetas + archivos)
// GET /api/drive/search?q=texto
router.get('/search', searchItems);

export default router;
