// src/controllers/driveController.js
import Folder from '../models/Folder.js';
import File from '../models/File.js';
import logActivity from '../utils/logActivity.js';

function getUserId(req) {
  return req.userId || req.user?.id || req.user?._id;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeSafe(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeText(value) {
  return decodeSafe(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * GET /api/drive/items?folderId=<id>
 * Lista carpetas + archivos dentro de una carpeta (o raíz si no hay folderId)
 */
export const getItemsInFolder = async (req, res) => {
  try {
    const owner = getUserId(req);
    if (!owner) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { folderId } = req.query;
    const filterParent = folderId || null;

    const folders = await Folder.find({
      owner,
      parent: filterParent,
    })
      .sort({ name: 1 })
      .lean();

    const files = await File.find({
      owner,
      folder: filterParent,
    })
      .sort({ originalName: 1 })
      .lean();

    let breadcrumbs = [];
    if (folderId) {
      let current = await Folder.findOne({ _id: folderId, owner }).lean();
      while (current) {
        breadcrumbs.unshift({
          _id: current._id,
          name: current.name,
        });
        if (!current.parent) break;
        current = await Folder.findOne({
          _id: current.parent,
          owner,
        }).lean();
      }
    }

    return res.json({
      folders,
      files,
      breadcrumbs,
    });
  } catch (err) {
    console.error('getItemsInFolder error:', err);
    return res
      .status(500)
      .json({ message: 'Error al obtener carpetas y archivos.' });
  }
};

/**
 * POST /api/drive/folders
 * Crear carpeta (en raíz o dentro de otra carpeta)
 */
export const createFolder = async (req, res) => {
  try {
    const owner = getUserId(req);
    if (!owner) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { name, parentId } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ message: 'El nombre de la carpeta es obligatorio.' });
    }

    const trimmedName = decodeSafe(name.trim());

    const existing = await Folder.findOne({
      owner,
      parent: parentId || null,
      name: trimmedName,
    });

    if (existing) {
      return res.status(409).json({
        message: 'Ya existe una carpeta con ese nombre en esta ubicación.',
      });
    }

    const folder = await Folder.create({
      name: trimmedName,
      parent: parentId || null,
      owner,
    });

    logActivity(owner, 'create_folder', trimmedName);
    return res.status(201).json(folder);
  } catch (err) {
    console.error('createFolder error:', err);
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Ya existe una carpeta con ese nombre en esta ubicación.',
      });
    }
    return res
      .status(500)
      .json({ message: 'Error al crear la carpeta.' });
  }
};

/**
 * PATCH /api/drive/folders/:id
 * Renombrar carpeta
 */
export const renameFolder = async (req, res) => {
  try {
    const owner = getUserId(req);
    if (!owner) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ message: 'El nuevo nombre es obligatorio.' });
    }

    const folder = await Folder.findOne({ _id: id, owner });
    if (!folder) {
      return res.status(404).json({ message: 'Carpeta no encontrada.' });
    }

    const trimmedName = decodeSafe(name.trim());

    const duplicate = await Folder.findOne({
      _id: { $ne: id },
      owner,
      parent: folder.parent || null,
      name: trimmedName,
    });

    if (duplicate) {
      return res.status(409).json({
        message: 'Ya existe una carpeta con ese nombre en esta ubicación.',
      });
    }

    folder.name = trimmedName;
    await folder.save();

    logActivity(owner, 'rename', trimmedName);
    return res.json(folder);
  } catch (err) {
    console.error('renameFolder error:', err);
    return res
      .status(500)
      .json({ message: 'Error al renombrar la carpeta.' });
  }
};

/**
 * DELETE /api/drive/folders/:id
 * Eliminar carpeta (solo si está vacía)
 */
export const deleteFolder = async (req, res) => {
  try {
    const owner = getUserId(req);
    if (!owner) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const { id } = req.params;

    const folder = await Folder.findOne({ _id: id, owner });
    if (!folder) {
      return res.status(404).json({ message: 'Carpeta no encontrada.' });
    }

    const childCount = await Folder.countDocuments({
      parent: id,
      owner,
    });

    const fileCount = await File.countDocuments({
      folder: id,
      owner,
    });

    if (childCount > 0 || fileCount > 0) {
      return res.status(400).json({
        message:
          'No puedes eliminar una carpeta que tiene subcarpetas o archivos.',
      });
    }

    const folderName = folder.name;
    await Folder.deleteOne({ _id: id, owner });

    logActivity(owner, 'delete_folder', folderName);
    return res.json({ ok: true, message: 'Carpeta eliminada.' });
  } catch (err) {
    console.error('deleteFolder error:', err);
    return res
      .status(500)
      .json({ message: 'Error al eliminar la carpeta.' });
  }
};

/**
 * GET /api/drive/search?q=texto
 * Búsqueda GLOBAL de carpetas + archivos del usuario
 */
export const searchItems = async (req, res) => {
  try {
    const owner = getUserId(req);
    if (!owner) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ folders: [], files: [] });
    }

    const regex = new RegExp(escapeRegex(q), 'i');

    const foldersRaw = await Folder.find({ owner })
      .sort({ updatedAt: -1 })
      .lean();

    const filesRaw = await File.find({ owner })
      .sort({ updatedAt: -1 })
      .lean();

    const folders = foldersRaw
      .filter((folder) => {
        const original = folder.name || '';
        return regex.test(original) || normalizeText(original).includes(normalizeText(q));
      })
      .slice(0, 50);

    const files = filesRaw
      .filter((file) => {
        const original = file.originalName || file.name || '';
        return regex.test(original) || normalizeText(original).includes(normalizeText(q));
      })
      .slice(0, 50);

    return res.json({ folders, files });
  } catch (err) {
    console.error('searchItems error:', err);
    return res.status(500).json({ message: 'Error en búsqueda global.' });
  }
};

export default {
  getItemsInFolder,
  createFolder,
  renameFolder,
  deleteFolder,
  searchItems,
};