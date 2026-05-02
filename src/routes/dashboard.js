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

export default router;
