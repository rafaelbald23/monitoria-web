import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// List products
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Buscar produtos que pertencem ao usuário através do mapeamento com contas Bling
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
        mappings: {
          where: {
            account: {
              userId: userId,
            },
          },
          include: {
            account: {
              select: { name: true, userId: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = products.map((p) => {
      const stock = p.movements.reduce((sum, m) => {
        return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
      }, 0);

      const mapping = p.mappings[0];
      
      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        price: p.salePrice || 0,
        stock,
        accountId: mapping?.accountId || '',
        accountName: mapping?.account?.name || '',
        isActive: p.isActive,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

// Create product
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sku, name, price, stock, accountId } = req.body;
    const userId = req.user!.userId;

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        salePrice: price || 0,
        isActive: true,
      },
    });

    // Create initial stock movement
    if (stock > 0) {
      await prisma.movement.create({
        data: {
          type: 'ENTRY',
          productId: product.id,
          quantity: stock,
          reason: 'Estoque inicial',
          userId,
          syncStatus: 'pending',
        },
      });
    }

    // Create mapping if accountId provided
    if (accountId) {
      await prisma.productMapping.create({
        data: {
          productId: product.id,
          accountId,
          blingProductId: product.id,
          blingSku: sku,
        },
      });
    }

    res.json({ id: product.id, ...req.body });
  } catch (error: any) {
    console.error('Erro ao criar produto:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'SKU já existe' });
    } else {
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }
});

// Update product
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, name, price, stock } = req.body;
    const userId = req.user!.userId;

    // Verificar se o produto pertence ao usuário
    const product = await prisma.product.findFirst({
      where: {
        id,
        mappings: {
          some: {
            account: {
              userId: userId,
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    await prisma.product.update({
      where: { id },
      data: {
        sku,
        name,
        salePrice: price || 0,
      },
    });

    // Adjust stock if changed
    if (stock !== undefined) {
      const movements = await prisma.movement.findMany({
        where: { productId: id, userId },
      });

      const currentStock = movements.reduce((sum, m) => {
        return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
      }, 0);

      const diff = stock - currentStock;
      if (diff !== 0) {
        await prisma.movement.create({
          data: {
            type: diff > 0 ? 'ENTRY' : 'EXIT',
            productId: id,
            quantity: Math.abs(diff),
            reason: 'Ajuste de estoque',
            userId,
            syncStatus: 'pending',
          },
        });
      }
    }

    res.json({ id, ...req.body });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// Delete product
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verificar se o produto pertence ao usuário
    const product = await prisma.product.findFirst({
      where: {
        id,
        mappings: {
          some: {
            account: {
              userId: userId,
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ error: 'Erro ao excluir produto' });
  }
});

export default router;
