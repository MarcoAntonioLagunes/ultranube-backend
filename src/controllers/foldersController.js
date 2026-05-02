// src/controllers/foldersController.js
import Folder from '../models/Folder.js';
import File from '../models/File.js';

/**
 * Crear carpeta (con manejo de duplicados)
 */
export const createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const owner = req.user.id; // viene del middleware auth

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'El nombre es obligatorio.' });
    }

    // 1️⃣ Verificar si ya existe una carpeta igual en este nivel
    const existing = await Folder.findOne({
      owner,
      name: name.trim(),
      parent: parentId || null,
    });

    if (existing) {
      // Ya existe → se regresa la misma carpeta sin error
      return res.json(existing);
    }

    // 2️⃣ Crear la carpeta porque no existe
    const folder = await Folder.create({
      name: name.trim(),
      parent: parentId || null,
      owner,
    });

    return res.json(folder);
  } catch (err) {
    console.error('createFolder error:', err);

    // 3️⃣ Si rompe por índice único (11000)
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Ya existe una carpeta con ese nombre en esta ubicación.',
      });
    }

    return res.status(500).json({ message: 'Error al crear carpeta.' });
  }
};

/**
 * Renombrar carpeta
 */
export const renameFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const owner = req.user.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nuevo nombre requerido.' });
    }

    const folder = await Folder.findOneAndUpdate(
      { _id: id, owner },
      { name: name.trim() },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ message: 'Carpeta no encontrada.' });
    }

    return res.json(folder);
  } catch (err) {
    console.error('renameFolder error:', err);
    return res.status(500).json({ message: 'Error al renombrar carpeta.' });
  }
};

/**
 * Eliminar carpeta (solo si está vacía)
 */
export const deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const owner = req.user.id;

    // Contar subcarpetas
    const childCount = await Folder.countDocuments({ parent: id, owner });

    // Contar archivos dentro
    const fileCount = await File.countDocuments({ folder: id, owner });

    if (childCount > 0 || fileCount > 0) {
      return res.status(400).json({
        message:
          'No puedes eliminar una carpeta que tiene subcarpetas o archivos.',
      });
    }

    const result = await Folder.deleteOne({ _id: id, owner });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Carpeta no encontrada.' });
    }

    return res.json({ ok: true, message: 'Carpeta eliminada.' });
  } catch (err) {
    console.error('deleteFolder error:', err);
    return res.status(500).json({ message: 'Error al eliminar carpeta.' });
  }
};
