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

    console.log(`📊 Produtos encontrados para usuário ${userId}: ${products.length}`);
    
    const result = products.map((p) => {
      const stock = p.movements.reduce((sum, m) => {
        return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
      }, 0);

      const mapping = p.mappings[0];
      
      return {
        id: p.id,
        sku: p.sku,
        ean: p.ean || '',
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

// Search product by EAN or SKU (for barcode scanner)
router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: 'Código não informado' });
    }

    // Buscar por EAN ou SKU
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [
          { ean: code as string },
          { sku: code as string },
        ],
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

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const stock = product.movements.reduce((sum, m) => {
      return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
    }, 0);

    res.json({
      id: product.id,
      sku: product.sku,
      ean: product.ean || '',
      name: product.name,
      price: product.salePrice || 0,
      stock,
    });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// Create product
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { sku, ean, name, price, stock, accountId } = req.body;
    const userId = req.user!.userId;

    const product = await prisma.product.create({
      data: {
        sku,
        ean: ean || null,
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
    const { sku, ean, name, price, stock } = req.body;
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
        ean: ean || null,
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

// Zerar todo o estoque
router.post('/zero-all-stock', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { ownerPassword } = req.body;

    console.log(`Iniciando processo de zerar todo estoque para usuário: ${userId}`);

    // Buscar informações do usuário atual
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        isOwner: true,
        ownerId: true,
        owner: {
          select: {
            id: true,
            username: true,
            name: true,
            password: true,
          },
        },
      },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Determinar qual é o dono da conta e validar senha
    let ownerUser: any;
    
    if (currentUser.isOwner) {
      // Se o usuário atual é o dono, buscar sua própria senha
      const owner = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { id: true, username: true, name: true, password: true },
      });
      ownerUser = owner;
      console.log(`Usuário atual é o dono: ${owner?.username}`);
    } else if (currentUser.owner) {
      // Se o usuário atual é funcionário, usar dados do dono
      ownerUser = currentUser.owner;
      console.log(`Usuário é funcionário, dono: ${ownerUser.username}`);
    } else {
      // Caso especial: usuário sem estrutura de dono definida
      // Pode ser usuário antigo ou master, tratá-lo como dono
      console.log(`Usuário sem estrutura de dono, tratando como dono: ${currentUser.username}`);
      const owner = await prisma.user.findUnique({
        where: { id: currentUser.id },
        select: { id: true, username: true, name: true, password: true },
      });
      ownerUser = owner;
    }

    if (!ownerUser) {
      return res.status(400).json({ error: 'Dados do dono da conta não encontrados' });
    }

    // Validar senha do dono
    if (!ownerPassword) {
      return res.status(400).json({ error: 'Senha do administrador é obrigatória' });
    }

    const bcrypt = await import('bcryptjs');
    const isPasswordValid = await bcrypt.compare(ownerPassword, ownerUser.password);

    if (!isPasswordValid) {
      console.log(`Tentativa de zerar estoque com senha incorreta para o dono: ${ownerUser.username}`);
      return res.status(403).json({ 
        error: 'Senha do administrador incorreta',
        ownerName: ownerUser.name 
      });
    }

    console.log(`Senha do administrador validada: ${ownerUser.username}`);

    // Buscar todos os produtos do usuário
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

    console.log(`Encontrados ${products.length} produtos para zerar estoque`);

    let processedCount = 0;
    let zeroedCount = 0;

    // Processar cada produto
    for (const product of products) {
      try {
        // Calcular estoque atual
        const currentStock = product.movements.reduce((sum, m) => {
          return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
        }, 0);

        // Se tem estoque, criar movimento para zerar
        if (currentStock !== 0) {
          await prisma.movement.create({
            data: {
              type: currentStock > 0 ? 'EXIT' : 'ENTRY',
              productId: product.id,
              quantity: Math.abs(currentStock),
              reason: `Zerado em lote por ${currentUser.username} (autorizado pelo administrador ${ownerUser.name})`,
              userId: userId,
              syncStatus: 'completed',
            },
          });

          console.log(`Produto ${product.name}: ${currentStock} → 0`);
          zeroedCount++;
        }

        processedCount++;
      } catch (productError) {
        console.error(`Erro ao zerar produto ${product.name}:`, productError);
      }
    }

    console.log(`Processo concluído: ${processedCount} produtos processados, ${zeroedCount} estoques zerados`);

    res.json({
      success: true,
      message: `${zeroedCount} produtos tiveram o estoque zerado`,
      processed: processedCount,
      zeroed: zeroedCount,
    });
  } catch (error) {
    console.error('Erro ao zerar todo estoque:', error);
    res.status(500).json({ error: 'Erro ao zerar estoque' });
  }
});

export default router;
