// src/controllers/searchController.js
import File from '../models/File.js';
import Folder from '../models/Folder.js';

// GET /api/search?q=texto
export const searchItems = async (req, res) => {
  try {
    const ownerId = req.user?.id || req.user?._id; // viene del middleware auth
    const q = (req.query.q || '').trim();

    if (!q) {
      return res.json({ folders: [], files: [] });
    }

    const regex = new RegExp(q, 'i'); // búsqueda insensible a mayúsculas

    const folders = await Folder.find({
      owner: ownerId,
      name: regex,
    })
      .sort({ updatedAt: -1 })
      .limit(20);

    const files = await File.find({
      owner: ownerId,
      originalName: regex,
    })
      .sort({ updatedAt: -1 })
      .limit(20);

    return res.json({ folders, files });
  } catch (err) {
    console.error('searchItems error:', err);
    return res.status(500).json({ message: 'Error en búsqueda' });
  }
};

export default { searchItems };
