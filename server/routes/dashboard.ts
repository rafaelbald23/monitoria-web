import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest, getOwnerUserId } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ownerUserId = await getOwnerUserId(userId);
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
              userId: ownerUserId,
            },
          },
        },
      },
      include: {
        movements: {
          where: { userId: ownerUserId },
        },
      },
    });

    // Get movements in the selected period
    const movementsInPeriod = await prisma.movement.findMany({
      where: {
        userId: ownerUserId,
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            ean: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get Bling orders to filter by status (BUSCAR ANTES para usar nos filtros)
    const blingOrders = await prisma.blingOrder.findMany({
      where: {
        userId: ownerUserId,
      },
      select: {
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    // Status que contam para vendas: Verificado, Atendido, Despachado
    const validStatuses = ['verificado', 'atendido', 'despachado'];
    const validOrders = blingOrders.filter(order => 
      validStatuses.includes(order.status.toLowerCase())
    );

    // Números de pedidos válidos (para filtrar saídas)
    const validOrderNumbers = validOrders.map(o => o.orderNumber);

    // Calculate entries and exits in period
    const entries = movementsInPeriod.filter(m => m.type === 'ENTRY');
    
    // Para saídas, filtrar apenas as que vieram de pedidos com status válidos
    const exits = movementsInPeriod.filter(m => {
      if (m.type !== 'EXIT') return false;
      
      const reason = m.reason || '';
      
      // Se não menciona "Pedido", não é de venda do Bling
      if (!reason.includes('Pedido')) return false;
      
      // Verificar se menciona algum número de pedido válido
      return validOrderNumbers.some(orderNum => reason.includes(orderNum));
    });
    
    const totalEntriesQty = entries.reduce((sum, m) => sum + m.quantity, 0);
    const totalExitsQty = exits.reduce((sum, m) => sum + m.quantity, 0);
    const totalEntriesCount = entries.length;
    const totalExitsCount = exits.length;

    // Detalhes das entradas (produtos que entraram)
    const entryDetails = entries.map(m => ({
      productId: m.product.id,
      productName: m.product.name,
      sku: m.product.sku,
      ean: m.product.ean,
      quantity: m.quantity,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    }));

    // Detalhes das saídas (produtos que saíram)
    const exitDetails = exits.map(m => ({
      productId: m.product.id,
      productName: m.product.name,
      sku: m.product.sku,
      ean: m.product.ean,
      quantity: m.quantity,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    }));

    // Get sales
    const sales = await prisma.sale.findMany({
      where: { userId: ownerUserId },
      orderBy: { createdAt: 'desc' },
    });

    // Get accounts
    const accounts = await prisma.blingAccount.findMany({
      where: { userId: ownerUserId },
    });

    // Calculate low stock items
    let lowStockItems = 0;
    for (const p of products) {
      const stock = p.movements.reduce((sum, m) => {
        return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
      }, 0);
      if (stock < 10) lowStockItems++;
    }

    // Sales in period (apenas com status válidos)
    const validOrdersInPeriod = validOrders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });

    // Total de vendas (todos os períodos, apenas status válidos)
    const totalSalesAmount = validOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    res.json({
      // Estatísticas do período selecionado
      periodStats: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalEntriesQty,
        totalExitsQty,
        totalEntriesCount,
        totalExitsCount,
        salesInPeriod: validOrdersInPeriod.reduce((sum, order) => sum + order.totalAmount, 0),
        salesCount: validOrdersInPeriod.length,
        entryDetails, // Detalhes dos produtos que entraram
        exitDetails,  // Detalhes dos produtos que saíram
      },
      
      // Estatísticas gerais
      todaySales: validOrdersInPeriod.reduce((sum, order) => sum + order.totalAmount, 0),
      lowStockItems,
      activeProducts: products.length,
      blingAccounts: accounts.filter((a) => a.isActive).length,
      totalSales: totalSalesAmount, // Apenas vendas com status válidos
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
