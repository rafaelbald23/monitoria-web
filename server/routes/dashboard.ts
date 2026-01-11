import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get products that belong to this user (through account mappings)
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        mappings: {
          some: {
            account: {
              userId: userId,
            },
          },
        },
      },
      include: {
        movements: {
          where: { userId: userId },
        },
      },
    });

    // Get sales
    const sales = await prisma.sale.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Get accounts
    const accounts = await prisma.blingAccount.findMany({
      where: { userId },
    });

    // Calculate low stock items
    let lowStockItems = 0;
    for (const p of products) {
      const stock = p.movements.reduce((sum, m) => {
        return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
      }, 0);
      if (stock < 10) lowStockItems++;
    }

    // Today's sales
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySales = sales.filter((s) => new Date(s.createdAt) >= today);

    res.json({
      todaySales: todaySales.reduce((sum, s) => sum + s.totalAmount, 0),
      lowStockItems,
      activeProducts: products.length,
      blingAccounts: accounts.filter((a) => a.isActive).length,
      totalSales: sales.reduce((sum, s) => sum + s.totalAmount, 0),
      recentSales: sales.slice(0, 5).map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        totalAmount: s.totalAmount,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
});

export default router;
