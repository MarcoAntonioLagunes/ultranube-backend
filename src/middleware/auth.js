// src/middleware/auth.js
import jwt from 'jsonwebtoken';

export const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guardamos info del usuario en la request
    req.userId = decoded.id || decoded._id || decoded.userId;
    req.user = decoded;

    next();
  } catch (err) {
    console.error('auth middleware error:', err.message);
    return res.status(401).json({ message: 'Token inválido' });
  }
};

// 👇 Esto hace que también exista export default
export default auth;
