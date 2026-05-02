import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function register(req,res){
  const { name, email, password } = req.body;
  if(!name || !email || !password) return res.status(400).json({error:'Missing fields'});
  const exists = await User.findOne({ email });
  if(exists) return res.status(400).json({error:'Email already used'});
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
}

export async function login(req,res){
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if(!user) return res.status(400).json({error:'Invalid credentials'});
  const ok = await bcrypt.compare(password, user.passwordHash);
  if(!ok) return res.status(400).json({error:'Invalid credentials'});
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
}

export async function me(req,res){
  const user = await User.findById(req.userId).select('name email');
  res.json({ id: user._id, name: user.name, email: user.email });
}
