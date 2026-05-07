// src/controllers/filesController.js
import File from '../models/File.js';
import fs from 'fs';
import logActivity from '../utils/logActivity.js';

const getUserId = (req) => req.userId || req.user?.id || req.user?._id;

function decodeSafe(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// =================== SUBIR ARCHIVO ===================
export const uploadFile = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    if (!ownerId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No se envió archivo.' });
    }

    const { folderId, folder } = req.body;
    const folderRef = folderId || folder || null;

    const originalName = decodeSafe(req.file.originalname);

    const existing = await File.findOne({
      owner: ownerId,
      folder: folderRef,
      originalName,
    });

    if (existing) {
      return res.status(409).json({
        message: 'Ya existe un archivo con ese nombre en esta carpeta.',
      });
    }

    const fileDoc = await File.create({
      originalName,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      folder: folderRef,
      owner: ownerId,
      path: req.file.path,
    });

    logActivity(ownerId, 'upload', originalName, { size: req.file.size });
    return res.status(201).json(fileDoc);
  } catch (err) {
    console.error('uploadFile error:', err);
    return res.status(500).json({ message: 'Error al subir archivo.' });
  }
};

// =================== RENOMBRAR ARCHIVO ===================
export const renameFile = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    const { id } = req.params;
    const newName = decodeSafe((req.body.name || req.body.originalName || '').trim());

    if (!ownerId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    if (!newName) {
      return res.status(400).json({ message: 'Nombre requerido.' });
    }

    const fileDoc = await File.findOne({ _id: id, owner: ownerId });
    if (!fileDoc) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const duplicate = await File.findOne({
      _id: { $ne: id },
      owner: ownerId,
      folder: fileDoc.folder || null,
      originalName: newName,
    });

    if (duplicate) {
      return res
        .status(409)
        .json({ message: 'Ya existe un archivo con ese nombre en esta carpeta.' });
    }

    fileDoc.originalName = newName;
    await fileDoc.save();

    return res.json(fileDoc);
  } catch (err) {
    console.error('renameFile error:', err);
    return res.status(500).json({ message: 'Error al renombrar archivo.' });
  }
};

// =================== ELIMINAR ARCHIVO ===================
export const deleteFile = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    const { id } = req.params;

    if (!ownerId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const fileDoc = await File.findOne({ _id: id, owner: ownerId });

    if (!fileDoc) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    const deletedName = fileDoc.originalName;
    await File.deleteOne({ _id: fileDoc._id });

    if (fileDoc.path && fs.existsSync(fileDoc.path)) {
      fs.unlink(fileDoc.path, (err) => {
        if (err) {
          console.warn('No se pudo borrar archivo físico:', err.message);
        }
      });
    }

    logActivity(ownerId, 'delete_file', deletedName);
    return res.json({ message: 'Archivo eliminado.' });
  } catch (err) {
    console.error('deleteFile error:', err);
    return res.status(500).json({ message: 'Error al eliminar archivo.' });
  }
};

// =================== ARCHIVOS RECIENTES ===================
export const getRecentFiles = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    if (!ownerId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const files = await File.find({ owner: ownerId })
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json(files);
  } catch (err) {
    console.error('getRecentFiles error:', err);
    return res.status(500).json({ message: 'Error al obtener recientes.' });
  }
};

// =================== MOVER ARCHIVO ===================
export const moveFile = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    const { id } = req.params;
    const { folderId } = req.body;

    if (!ownerId) return res.status(401).json({ message: 'No autenticado.' });

    const fileDoc = await File.findOne({ _id: id, owner: ownerId });
    if (!fileDoc) return res.status(404).json({ message: 'Archivo no encontrado.' });

    const targetFolder = folderId || null;

    const duplicate = await File.findOne({
      _id: { $ne: id },
      owner: ownerId,
      folder: targetFolder,
      originalName: fileDoc.originalName,
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Ya existe un archivo con ese nombre en la carpeta destino.' });
    }

    fileDoc.folder = targetFolder;
    await fileDoc.save();
    logActivity(ownerId, 'move', fileDoc.originalName);
    return res.json(fileDoc);
  } catch (err) {
    console.error('moveFile error:', err);
    return res.status(500).json({ message: 'Error al mover archivo.' });
  }
};

// =================== TODOS LOS ARCHIVOS DEL USUARIO ===================
export const getAllFiles = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    if (!ownerId) return res.status(401).json({ message: 'No autenticado.' });

    const files = await File.find({ owner: ownerId })
      .select('originalName mimeType size folder createdAt')
      .sort({ createdAt: -1 })
      .limit(500);

    return res.json(files);
  } catch (err) {
    console.error('getAllFiles error:', err);
    return res.status(500).json({ message: 'Error al obtener archivos.' });
  }
};

// =================== DESCARGAR ARCHIVO ===================
export const downloadFile = async (req, res) => {
  try {
    const ownerId = getUserId(req);
    const { id } = req.params;

    if (!ownerId) {
      return res.status(401).json({ message: 'No autenticado.' });
    }

    const fileDoc = await File.findOne({ _id: id, owner: ownerId });

    if (!fileDoc) {
      return res.status(404).json({ message: 'Archivo no encontrado.' });
    }

    if (!fileDoc.path || !fs.existsSync(fileDoc.path)) {
      return res
        .status(404)
        .json({ message: 'Archivo físico no encontrado en el servidor.' });
    }

    const filename = decodeSafe(fileDoc.originalName || fileDoc.fileName || 'archivo');
    logActivity(ownerId, 'download', filename);
    res.download(fileDoc.path, filename);
  } catch (err) {
    console.error('downloadFile error:', err);
    return res.status(500).json({ message: 'Error al descargar archivo.' });
  }
};