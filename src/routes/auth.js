// src/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { rateLimit } from 'express-rate-limit';
import { Resend } from 'resend';

import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// ── Rate limiter ──────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos, intenta en 15 minutos.' },
});

// ── Avatar multer config ──────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const avatarDir = path.join(__dirname, '../../uploads/avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarDir),
    filename: (_req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Solo imágenes')),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

function createToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

function resolveAvatar(avatar) {
  if (!avatar) return null;
  // Rewrite stale localhost URLs stored before BASE_URL was configured
  if (avatar.startsWith('http://localhost')) return avatar.replace(/^http:\/\/localhost:\d+/, BASE_URL);
  // Relative path → prepend BASE_URL
  if (avatar.startsWith('/')) return `${BASE_URL}${avatar}`;
  return avatar;
}

const userPayload = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role, avatar: resolveAvatar(u.avatar),
});

// ── POST /register ────────────────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  try {
    let { name, email, password } = req.body;
    name  = (name  || '').trim();
    email = (email || '').trim().toLowerCase();

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    if (!EMAIL_REGEX.test(email))
      return res.status(400).json({ message: 'Correo electrónico no válido' });
    if (!PASSWORD_REGEX.test(password))
      return res.status(400).json({ message: 'La contraseña debe tener mínimo 8 caracteres con letras y números' });
    if (await User.findOne({ email }))
      return res.status(409).json({ message: 'Ya existe una cuenta con ese correo' });

    const user  = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    return res.status(201).json({ ok: true, token: createToken(user), user: userPayload(user) });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  try {
    let { email, password } = req.body;
    email = (email || '').trim().toLowerCase();
    const INVALID = 'Credenciales inválidas';

    if (!email || !password || !EMAIL_REGEX.test(email))
      return res.status(401).json({ message: INVALID });

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: INVALID });

    return res.json({ ok: true, token: createToken(user), user: userPayload(user) });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password -resetToken -resetTokenExp');
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json(userPayload(user));
  } catch (err) {
    return res.status(500).json({ message: 'Error al obtener perfil' });
  }
});

// ── PATCH /me — update display name ──────────────────────────────────────────
router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name || name.length < 2 || name.length > 80)
      return res.status(400).json({ message: 'El nombre debe tener entre 2 y 80 caracteres' });

    const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true });
    return res.json({ ok: true, user: userPayload(user) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al actualizar nombre' });
  }
});

// ── POST /avatar — upload profile picture ────────────────────────────────────
router.post('/avatar', authMiddleware, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No se envió imagen' });
    const avatarPath = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.userId, { avatar: avatarPath }, { new: true });
    return res.json({ ok: true, user: userPayload(user) });
  } catch (err) {
    console.error('avatar error:', err);
    return res.status(500).json({ message: 'Error al subir avatar' });
  }
});

// ── POST /change-password ─────────────────────────────────────────────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    if (!PASSWORD_REGEX.test(newPassword))
      return res.status(400).json({ message: 'La nueva contraseña debe tener mínimo 8 caracteres con letras y números' });

    const user = await User.findById(req.userId);
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ message: 'La contraseña actual es incorrecta' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ ok: true, message: 'Contraseña actualizada' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
});

// ── POST /forgot-password ─────────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    let { email } = req.body;
    email = (email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Correo inválido' });

    const user = await User.findOne({ email });
    // Never reveal whether the email exists
    if (!user) return res.json({ ok: true, message: 'Si el correo existe se enviará un enlace' });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken    = token;
    user.resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
    const resetUrl    = `${frontendUrl}/reset-password?token=${token}`;

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'UltraNube <onboarding@resend.dev>',
        to: user.email,
        subject: 'Recupera tu contraseña — UltraNube',
        html: `
          <div style="font-family:system-ui;max-width:560px;margin:0 auto;padding:32px 24px;background:#050509;color:#f0f0ff;border-radius:16px">
            <h2 style="color:#ff2d95;margin:0 0 16px">UltraNube</h2>
            <p>Hola <strong>${user.name}</strong>,</p>
            <p style="color:#b0b0cc">Alguien solicitó recuperar tu contraseña. El enlace expira en <strong>1 hora</strong>.</p>
            <a href="${resetUrl}" style="display:inline-block;background:#ff2d95;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;margin:20px 0">
              Restablecer contraseña
            </a>
            <p style="color:#555;font-size:0.8rem">Si no solicitaste esto, ignora este correo.</p>
          </div>`,
      });
    } else {
      // Development fallback — print the link to server console
      console.log(`[UltraNube] Reset link for ${email}: ${resetUrl}`);
    }

    return res.json({ ok: true, message: 'Si el correo existe se enviará un enlace' });
  } catch (err) {
    console.error('forgot-password error:', err);
    return res.status(500).json({ message: 'Error al enviar correo de recuperación' });
  }
});

// ── POST /reset-password ──────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ message: 'Token y nueva contraseña son requeridos' });
    if (!PASSWORD_REGEX.test(newPassword))
      return res.status(400).json({ message: 'La contraseña debe tener mínimo 8 caracteres con letras y números' });

    const user = await User.findOne({ resetToken: token, resetTokenExp: { $gt: new Date() } });
    if (!user)
      return res.status(400).json({ message: 'El enlace de recuperación es inválido o ha expirado' });

    user.password      = await bcrypt.hash(newPassword, 10);
    user.resetToken    = undefined;
    user.resetTokenExp = undefined;
    await user.save();

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    return res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
});

// ── POST /refresh ─────────────────────────────────────────────────────────────
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    return res.json({ ok: true, token: createToken(user), user: userPayload(user) });
  } catch (err) {
    return res.status(500).json({ message: 'Error al refrescar sesión' });
  }
});

export default router;
