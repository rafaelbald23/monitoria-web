import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    // Definir período padrão (hoje) se não fornecido
    let start = new Date();
    let end = new Date();
    
    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999); // Fim do dia
    } else {
      // Padrão: hoje
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    console.log(`📊 Dashboard stats - Período: ${start.toISOString()} até ${end.toISOString()}`);

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

    // Get movements in the selected period
    const movementsInPeriod = await prisma.movement.findMany({
      where: {
        userId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
      },
    });

    // Calculate entries and exits in period
    const entries = movementsInPeriod.filter(m => m.type === 'ENTRY');
    const exits = movementsInPeriod.filter(m => m.type === 'EXIT');
    
    const totalEntriesQty = entries.reduce((sum, m) => sum + m.quantity, 0);
    const totalExitsQty = exits.reduce((sum, m) => sum + m.quantity, 0);
    const totalEntriesCount = entries.length;
    const totalExitsCount = exits.length;

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

    // Sales in period
    const salesInPeriod = sales.filter((s) => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= start && saleDate <= end;
    });

    res.json({
      // Estatísticas do período selecionado
      periodStats: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalEntriesQty,
        totalExitsQty,
        totalEntriesCount,
        totalExitsCount,
        salesInPeriod: salesInPeriod.reduce((sum, s) => sum + s.totalAmount, 0),
        salesCount: salesInPeriod.length,
      },
      
      // Estatísticas gerais (mantidas para compatibilidade)
      todaySales: salesInPeriod.reduce((sum, s) => sum + s.totalAmount, 0),
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
