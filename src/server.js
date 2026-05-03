// src/server.js
import express from 'express';
import cors from 'cors';
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
const devOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

function buildAllowedOrigins() {
  if (!process.env.CORS_ORIGIN) return devOrigins;
  const origins = [];
  for (const raw of process.env.CORS_ORIGIN.split(',')) {
    const o = raw.trim().replace(/\/$/, ''); // strip trailing slash
    origins.push(o);
    // auto-include www ↔ non-www counterpart
    if (o.startsWith('https://www.')) origins.push(o.replace('https://www.', 'https://'));
    else if (o.startsWith('https://'))   origins.push(o.replace('https://', 'https://www.'));
  }
  return origins;
}

const allowedOrigins = buildAllowedOrigins();
console.log('CORS origins allowed:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Postman / mobile / server-to-server
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalized)) return callback(null, true);
      callback(new Error(`CORS: origen no permitido → ${origin}`));
    },
    credentials: true,
  })
);

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
