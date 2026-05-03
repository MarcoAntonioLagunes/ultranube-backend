// src/server.js
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { rateLimit } from 'express-rate-limit';

import aiRoutes from './routes/ai.js';
import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import driveRoutes from './routes/drive.js';
import searchRoutes from './routes/search.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://ultranube.com.mx');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ── Rate limiting global ───────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas peticiones, intenta más tarde.' },
});

// Rate limiting estricto para autenticación
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // máx 20 intentos por IP cada 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de acceso, intenta en 15 minutos.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static para descargas ──────────────────────────────────────────────────────
const __dirname = path.resolve();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Healthcheck ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Rutas API ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// ── Arrancar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4012;

mongoose
  .connect(process.env.MONGODB_URI || process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB conectado ✅');
    app.listen(PORT, () => {
      console.log(`API Ultranube escuchando en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB', err);
    process.exit(1);
  });
