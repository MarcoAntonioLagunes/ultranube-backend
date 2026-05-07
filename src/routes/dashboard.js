// src/routes/dashboard.js
import express from 'express';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/auth.js';
import Folder from '../models/Folder.js';
import File from '../models/File.js';

const router = express.Router();

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    const folders = await Folder.countDocuments({ owner: userId });
    const files = await File.countDocuments({ owner: userId });

    res.json({ folders, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error obteniendo estadísticas' });
  }
});

router.get('/storage', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.userId;
    const result = await File.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(String(userId)) } },
      { $group: { _id: null, totalSize: { $sum: '$size' }, fileCount: { $sum: 1 } } },
    ]);
    const totalBytes = result[0]?.totalSize  || 0;
    const fileCount  = result[0]?.fileCount  || 0;
    const limitBytes = 2 * 1024 * 1024 * 1024; // 2 GB
    return res.json({
      used:      totalBytes,
      limit:     limitBytes,
      fileCount,
      usedMB:    +(totalBytes  / 1024 / 1024).toFixed(1),
      limitGB:   2,
      maxFileMB: 50,
    });
  } catch (err) {
    console.error('storage stats error:', err);
    return res.status(500).json({ message: 'Error al obtener estadísticas de almacenamiento' });
  }
});

router.get('/type-breakdown', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const oid = new mongoose.Types.ObjectId(String(userId));

    const result = await File.aggregate([
      { $match: { owner: oid } },
      {
        $group: {
          _id: '$mimeType',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ]);

    const categories = {
      PDFs:       { count: 0, size: 0 },
      Imágenes:   { count: 0, size: 0 },
      Documentos: { count: 0, size: 0 },
      Videos:     { count: 0, size: 0 },
      Audio:      { count: 0, size: 0 },
      Otros:      { count: 0, size: 0 },
    };

    for (const row of result) {
      const m = row._id || '';
      let cat;
      if (m === 'application/pdf')                                    cat = 'PDFs';
      else if (m.startsWith('image/'))                                cat = 'Imágenes';
      else if (m.includes('word') || m.includes('document') ||
               m === 'text/plain' || m === 'text/markdown')           cat = 'Documentos';
      else if (m.startsWith('video/'))                                cat = 'Videos';
      else if (m.startsWith('audio/'))                                cat = 'Audio';
      else                                                            cat = 'Otros';

      categories[cat].count += row.count;
      categories[cat].size  += row.size;
    }

    const breakdown = Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .filter(c => c.count > 0);

    return res.json(breakdown);
  } catch (err) {
    console.error('type-breakdown error:', err);
    return res.status(500).json({ message: 'Error al obtener desglose.' });
  }
});

export default router;
