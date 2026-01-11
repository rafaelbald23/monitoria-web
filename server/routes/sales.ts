import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// List sales
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const sales = await prisma.sale.findMany({
      where: { userId },
      include: {
        account: {
          select: { name: true },
        },
        items: {
          include: {
            product: {
              select: { name: true, sku: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const result = sales.map((s) => ({
      id: s.id,
      saleNumber: s.saleNumber,
      totalAmount: s.totalAmount,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      accountName: s.account?.name || 'N/A',
      fiscalNoteStatus: s.fiscalNoteStatus,
      fiscalNoteNumber: s.fiscalNoteNumber,
      items: s.items,
    }));

    res.json(result);
  } catch (error) {
    console.error('Erro ao listar vendas:', error);
    res.status(500).json({ error: 'Erro ao listar vendas' });
  }
});

// Create sale
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { items, totalAmount, accountId } = req.body;
    const userId = req.user!.userId;

    // Generate sale number
    const lastSale = await prisma.sale.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let nextNum = 1;
    if (lastSale) {
      const match = lastSale.saleNumber.match(/\d+/);
      if (match) nextNum = parseInt(match[0]) + 1;
    }
    const saleNumber = `VND${String(nextNum).padStart(6, '0')}`;

    // Create sale
    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        userId,
        accountId: accountId || null,
        totalAmount,
        finalAmount: totalAmount,
        status: 'completed',
        fiscalNoteStatus: 'pending',
      },
    });

    // Create sale items and movements
    for (const item of items) {
      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });

      await prisma.movement.create({
        data: {
          type: 'EXIT',
          productId: item.productId,
          quantity: item.quantity,
          reason: `Venda ${saleNumber}`,
          userId,
          saleId: sale.id,
          syncStatus: 'pending',
        },
      });
    }

    res.json({ id: sale.id, saleNumber, totalAmount });
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: 'Erro ao criar venda' });
  }
});

// Get sale by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const sale = await prisma.sale.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        account: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro ao buscar venda' });
  }
});

export default router;
