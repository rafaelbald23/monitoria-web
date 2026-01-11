import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'monitoria-jwt-secret-2024-web';

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, error: 'Usuário inativo. Entre em contato com o suporte.' });
    }

    // Se for funcionário, verificar se o dono está ativo
    if (user.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: user.ownerId },
      });
      if (!owner || !owner.isActive || owner.subscriptionStatus === 'suspended') {
        return res.status(401).json({ success: false, error: 'Conta da empresa suspensa. Entre em contato com o administrador.' });
      }
    }

    // Verificar assinatura (exceto para master e funcionários)
    if (!user.isMaster && !user.ownerId && user.subscriptionStatus === 'suspended') {
      return res.status(401).json({ success: false, error: 'Assinatura suspensa. Entre em contato para regularizar.' });
    }

    if (!user.isMaster && !user.ownerId && user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) {
      // Suspender automaticamente se venceu
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'suspended', isActive: false },
      });
      return res.status(401).json({ success: false, error: 'Assinatura vencida. Entre em contato para renovar.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Determinar permissões
    let permissions: string[] = [];
    if (user.isMaster) {
      permissions = ['masterPanel']; // Master só acessa o painel master
    } else if (user.isOwner || !user.ownerId) {
      // Dono da conta tem acesso a tudo
      permissions = ['dashboard', 'products', 'sales', 'newSale', 'accounts', 'reports', 'settings', 'users'];
    } else if (user.permissions) {
      // Funcionário tem permissões específicas
      try {
        permissions = JSON.parse(user.permissions);
      } catch {
        permissions = [];
      }
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        accessToken: token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          isMaster: user.isMaster,
          isOwner: user.isOwner || (!user.ownerId && !user.isMaster),
          ownerId: user.ownerId,
          permissions,
        },
      },
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as { userId: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Usuário inválido' });
    }

    const newToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: { accessToken: newToken },
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Token inválido' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Senha atual incorreta' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

export default router;
