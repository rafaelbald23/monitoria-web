import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Middleware para verificar se é master
const requireMaster = async (req: AuthRequest, res: Response, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });
    if (!user?.isMaster) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  } catch (error) {
    res.status(403).json({ error: 'Acesso negado' });
  }
};

// Dashboard master - estatísticas gerais
router.get('/dashboard', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const totalClients = await prisma.user.count({ where: { isMaster: false } });
    const activeClients = await prisma.user.count({ where: { isMaster: false, isActive: true, subscriptionStatus: 'active' } });
    const suspendedClients = await prisma.user.count({ where: { isMaster: false, subscriptionStatus: 'suspended' } });
    const expiringClients = await prisma.user.count({
      where: {
        isMaster: false,
        subscriptionStatus: 'active',
        subscriptionEnd: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      },
    });

    // Calcular receita mensal (soma dos valores mensais dos clientes ativos)
    const activeClientsWithValue = await prisma.user.findMany({
      where: { isMaster: false, subscriptionStatus: 'active', monthlyValue: { not: null } },
      select: { monthlyValue: true },
    });
    const monthlyRevenue = activeClientsWithValue.reduce((sum, c) => sum + (c.monthlyValue || 0), 0);

    const recentLogins = await prisma.user.findMany({
      where: { isMaster: false, lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: 'desc' },
      take: 10,
      select: { id: true, name: true, companyName: true, lastLoginAt: true },
    });

    res.json({
      totalClients,
      activeClients,
      suspendedClients,
      expiringClients,
      monthlyRevenue,
      recentLogins,
    });
  } catch (error) {
    console.error('Erro no dashboard master:', error);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// Listar todos os clientes
router.get('/clients', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.user.findMany({
      where: { isMaster: false, isOwner: true },
      select: {
        id: true, username: true, name: true, email: true, phone: true, companyName: true,
        isActive: true, subscriptionStatus: true, subscriptionPlan: true,
        subscriptionStart: true, subscriptionEnd: true, lastPaymentDate: true,
        lastLoginAt: true, createdAt: true, monthlyValue: true, notes: true, maxEmployees: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(clients);
  } catch (error) {
    console.error('Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

// Criar novo cliente
router.post('/clients', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, name, email, phone, companyName, subscriptionPlan, subscriptionEnd, monthlyValue, notes, maxEmployees } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) {
      return res.status(400).json({ error: 'Usuário ou email já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const client = await prisma.user.create({
      data: {
        username, password: hashedPassword, name, email, phone, companyName,
        role: 'admin', isActive: true, isMaster: false, isOwner: true,
        subscriptionStatus: 'active', subscriptionPlan: subscriptionPlan || 'basic',
        subscriptionStart: new Date(),
        subscriptionEnd: subscriptionEnd ? new Date(subscriptionEnd) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        lastPaymentDate: new Date(),
        monthlyValue: monthlyValue || null,
        notes: notes || null,
        maxEmployees: maxEmployees || 3,
      },
    });

    res.json({ id: client.id, username: client.username, name: client.name });
  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

// Atualizar cliente
router.put('/clients/:id', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, phone, companyName, subscriptionPlan, subscriptionEnd, subscriptionStatus, isActive, password, monthlyValue, notes, maxEmployees } = req.body;

    const updateData: any = { name, email, phone, companyName, subscriptionPlan, subscriptionStatus, isActive, notes };
    
    if (subscriptionEnd) {
      updateData.subscriptionEnd = new Date(subscriptionEnd);
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }
    if (monthlyValue !== undefined) {
      updateData.monthlyValue = monthlyValue ? parseFloat(monthlyValue) : null;
    }
    if (maxEmployees !== undefined) {
      updateData.maxEmployees = parseInt(maxEmployees) || 3;
    }

    await prisma.user.update({ where: { id }, data: updateData });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

// Suspender cliente (não pagou)
router.post('/clients/:id/suspend', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.update({
      where: { id },
      data: { subscriptionStatus: 'suspended', isActive: false },
    });
    res.json({ success: true, message: 'Cliente suspenso' });
  } catch (error) {
    console.error('Erro ao suspender cliente:', error);
    res.status(500).json({ error: 'Erro ao suspender cliente' });
  }
});

// Reativar cliente (pagou)
router.post('/clients/:id/activate', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { daysToAdd } = req.body;
    
    const client = await prisma.user.findUnique({ where: { id } });
    const newEndDate = new Date();
    newEndDate.setDate(newEndDate.getDate() + (daysToAdd || 30));

    await prisma.user.update({
      where: { id },
      data: {
        subscriptionStatus: 'active',
        isActive: true,
        lastPaymentDate: new Date(),
        subscriptionEnd: newEndDate,
      },
    });
    res.json({ success: true, message: 'Cliente reativado' });
  } catch (error) {
    console.error('Erro ao reativar cliente:', error);
    res.status(500).json({ error: 'Erro ao reativar cliente' });
  }
});

// Registrar pagamento
router.post('/clients/:id/payment', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { daysToAdd, amount, method, notes } = req.body;

    const client = await prisma.user.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

    const currentEnd = client.subscriptionEnd || new Date();
    const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
    newEnd.setDate(newEnd.getDate() + (daysToAdd || 30));

    await prisma.user.update({
      where: { id },
      data: {
        lastPaymentDate: new Date(),
        subscriptionEnd: newEnd,
        subscriptionStatus: 'active',
        isActive: true,
      },
    });

    // Registrar histórico de pagamento
    if (amount) {
      await prisma.clientPayment.create({
        data: {
          clientId: id,
          amount: parseFloat(amount),
          daysAdded: daysToAdd || 30,
          method: method || null,
          notes: notes || null,
        },
      });
    }

    res.json({ success: true, newEndDate: newEnd });
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// Excluir cliente
router.delete('/clients/:id', authMiddleware, requireMaster, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir cliente:', error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
});

// Verificar se usuário é master
router.get('/check', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { isMaster: true },
    });
    res.json({ isMaster: user?.isMaster || false });
  } catch (error) {
    res.json({ isMaster: false });
  }
});

export default router;
