import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();

// List users (admin only)
router.get('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Create user (admin only)
router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, name, email, role } = req.body;

    // Check if username exists
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'Nome de usuário já existe' });
    }

    // Check if email exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        email,
        role: role || 'seller',
        isActive: true,
      },
    });

    res.json({ id: user.id, username: user.username, name: user.name });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Update user (admin only)
router.put('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive, password } = req.body;

    const updateData: any = { name, email, role, isActive };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deleting yourself
    if (id === req.user!.userId) {
      return res.status(400).json({ error: 'Você não pode excluir sua própria conta' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

export default router;
