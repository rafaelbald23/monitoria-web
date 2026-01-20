import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get current user info with employee limit
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Contar funcionários
    const employeeCount = await prisma.user.count({
      where: { ownerId: userId },
    });

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      isOwner: user.isOwner,
      isMaster: user.isMaster,
      companyName: user.companyName,
      maxEmployees: user.maxEmployees || 3,
      currentEmployees: employeeCount,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionEnd: user.subscriptionEnd,
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// Get owner info (for validation purposes)
router.get('/owner-info', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        isOwner: true,
        ownerId: true,
        owner: {
          select: {
            username: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Determinar informações do dono
    if (user.isOwner) {
      // Se o usuário atual é o dono
      res.json({
        ownerUsername: user.username,
        ownerName: user.name,
        isCurrentUserOwner: true,
      });
    } else if (user.owner) {
      // Se o usuário atual é funcionário
      res.json({
        ownerUsername: user.owner.username,
        ownerName: user.owner.name,
        isCurrentUserOwner: false,
      });
    } else {
      res.status(400).json({ error: 'Não foi possível identificar o dono da conta' });
    }
  } catch (error) {
    console.error('Erro ao buscar informações do dono:', error);
    res.status(500).json({ error: 'Erro ao buscar informações do dono' });
  }
});

// List users (for admin/owner)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se for dono, lista seus funcionários
    if (currentUser.isOwner) {
      const employees = await prisma.user.findMany({
        where: { ownerId: userId },
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
      return res.json(employees);
    }

    // Se for admin normal, lista usuários do mesmo dono
    if (currentUser.ownerId) {
      const employees = await prisma.user.findMany({
        where: { ownerId: currentUser.ownerId },
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
      return res.json(employees);
    }

    res.json([]);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// Create user/employee
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { username, password, name, email, role } = req.body;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se é dono da conta
    if (!currentUser.isOwner) {
      return res.status(403).json({ error: 'Apenas o dono da conta pode criar funcionários' });
    }

    // Verificar limite de funcionários
    const employeeCount = await prisma.user.count({
      where: { ownerId: userId },
    });

    const maxEmployees = currentUser.maxEmployees || 3;
    if (employeeCount >= maxEmployees) {
      return res.status(400).json({ 
        error: `Limite de funcionários atingido (${maxEmployees}). Entre em contato para aumentar seu plano.` 
      });
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
        role: role || 'seller',
        isActive: true,
        ownerId: userId,
        isOwner: false,
      },
    });

    res.json({ 
      id: employee.id, 
      username: employee.username, 
      name: employee.name,
    });
  } catch (error) {
    console.error('Erro ao criar funcionário:', error);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

// Update user/employee
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, email, isActive, password, role } = req.body;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se o funcionário pertence ao usuário
    const employee = await prisma.user.findFirst({
      where: { 
        id, 
        ownerId: currentUser.isOwner ? userId : currentUser.ownerId 
      },
    });

    if (!employee) {
      return res.status(404).json({ error: 'Funcionário não encontrado' });
    }

    const updateData: any = { name, email, role };
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    
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

// Delete user/employee
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se o funcionário pertence ao usuário
    const employee = await prisma.user.findFirst({
      where: { 
        id, 
        ownerId: currentUser.isOwner ? userId : currentUser.ownerId 
      },
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
