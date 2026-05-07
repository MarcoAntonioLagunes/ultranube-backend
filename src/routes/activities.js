import express from 'express';
import authMiddleware from '../middleware/auth.js';
import Activity from '../models/Activity.js';
import logActivity from '../utils/logActivity.js';

const router = express.Router();

const getUserId = (req) => req.userId || req.user?.id || req.user?._id;

// POST /api/activities/log — client-side action tracking (AI agents, etc.)
router.post('/log', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado.' });

    const { action, label, metadata } = req.body;
    if (!action || !label) return res.status(400).json({ message: 'action y label requeridos.' });

    await logActivity(userId, action, label, metadata || {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('log activity error:', err);
    return res.status(500).json({ message: 'Error al registrar actividad.' });
  }
});

// GET /api/activities/recent — last 10 events for activity timeline
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado.' });

    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    return res.json(activities);
  } catch (err) {
    console.error('get recent activities error:', err);
    return res.status(500).json({ message: 'Error al obtener actividad reciente.' });
  }
});

export default router;
