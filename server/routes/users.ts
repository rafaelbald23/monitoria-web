import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// List employees (for account owners)
router.get('/employees', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Verificar se é dono da conta
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser || (!currentUser.isOwner && currentUser.ownerId)) {
      return res.status(403).json({ error: 'Apenas o dono da conta pode gerenciar funcionários' });
    }

    const employees = await prisma.user.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(employees.map(e => ({
      ...e,
      permissions: e.permissions ? JSON.parse(e.permissions) : [],
    })));
  } catch (error) {
    console.error('Erro ao listar funcionários:', error);
    res.status(500).json({ error: 'Erro ao listar funcionários' });
  }
});

// Create employee
router.post('/employees', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { username, password, name, email, permissions } = req.body;

    // Verificar se é dono da conta
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser || (!currentUser.isOwner && currentUser.ownerId)) {
      return res.status(403).json({ error: 'Apenas o dono da conta pode criar funcionários' });
    }

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

    const employee = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        email,
        role: 'seller',
        isActive: true,
        ownerId: userId,
        isOwner: false,
        permissions: JSON.stringify(permissions || []),
      },
    });

    res.json({ 
      id: employee.id, 
      username: employee.username, 
      name: employee.name,
      permissions: permissions || [],
    });
  } catch (error) {
    console.error('Erro ao criar funcionário:', error);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

// Update employee
router.put('/employees/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, email, isActive, password, permissions } = req.body;

    // Verificar se o funcionário pertence ao usuário
    const employee = await prisma.user.findFirst({
      where: { id, ownerId: userId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const updateData: any = { 
      name, 
      email, 
      isActive,
      permissions: JSON.stringify(permissions || []),
    };
    
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar funcionário:', error);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

// Delete employee
router.delete('/employees/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verificar se o funcionário pertence ao usuário
    const employee = await prisma.user.findFirst({
      where: { id, ownerId: userId },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir funcionário:', error);
    res.status(500).json({ error: 'Erro ao excluir funcionário' });
  }
});

export default router;
