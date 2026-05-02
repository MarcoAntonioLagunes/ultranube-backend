// src/routes/folders.js
import express from 'express';
import auth from '../middleware/auth.js';
import {
  createFolder,
  getRootItems,
  getFolderItems,
  deleteFolder,
  renameFolder,
} from '../controllers/foldersController.js';

const router = express.Router();

// Crear carpeta (en raíz o dentro de otra carpeta)
router.post('/', auth, createFolder);

// Obtener items de la raíz
router.get('/root', auth, getRootItems);

// Obtener items de una carpeta específica
router.get('/:folderId/items', auth, getFolderItems);

// Eliminar carpeta
router.delete('/:id', auth, deleteFolder);

// Renombrar carpeta
router.put('/:id/rename', auth, renameFolder);

export default router;
