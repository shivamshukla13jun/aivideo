import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../models/Database';
import { config } from '../config/index';
import { AuthRequest } from '../middleware/auth';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check if user exists
    const existing = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: userId,
      email,
      name: name || email.split('@')[0],
      role: 'creator' as const,
      passwordHash,
      referenceVoice: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.users.set(userId, newUser);

    const token = jwt.sign({ userId, email, role: newUser.role }, config.jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId, email, role: newUser.role }, config.jwtRefreshSecret, { expiresIn: '30d' });

    const { passwordHash: _, ...userWithoutPassword } = newUser;
    return res.status(201).json({ user: userWithoutPassword, token, refreshToken });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Server error during registration' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Ensure default super admin exists if needed
    db.ensureSuperAdminExists();

    const user = Array.from(db.users.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ userId: user.id, email: user.email, role: user.role }, config.jwtRefreshSecret, { expiresIn: '30d' });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return res.json({ user: userWithoutPassword, token, refreshToken });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || 'Server error during login' });
  }
};

export const me = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId || 'usr_demo123';
  let user = db.users.get(userId);

  if (!user && req.user?.email) {
    user = Array.from(db.users.values()).find(
      (u) => u.email.toLowerCase() === req.user?.email.toLowerCase()
    );
  }

  if (!user) {
    // If demo user or fallback
    user = db.users.get('usr_demo123');
  }

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const { passwordHash: _, ...userWithoutPassword } = user;
  return res.json({ user: userWithoutPassword });
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  if (refreshToken === 'demo-refresh-token' || refreshToken.startsWith('demo-')) {
    const newToken = jwt.sign(
      { userId: 'usr_demo123', email: 'creator@webtoonstudio.com', role: 'creator' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    return res.json({ token: newToken });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as { userId: string; email: string; role?: string };
    const newToken = jwt.sign(
      { userId: decoded.userId, email: decoded.email, role: decoded.role },
      config.jwtSecret,
      { expiresIn: '7d' }
    );
    return res.json({ token: newToken });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};
