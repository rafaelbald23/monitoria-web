import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest, getOwnerUserId } from '../middleware/auth.js';

const router = Router();

// List products
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ownerUserId = await getOwnerUserId(userId);

    // Buscar produtos que pertencem ao usuário através do mapeamento com contas Bling
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
        mappings: {
          where: {
            account: {
              userId: ownerUserId,
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

    console.log(`📊 Produtos encontrados para usuário ${ownerUserId}: ${products.length}`);
    
    const result = products.map((p: any) => {
      const stock = p.movements.reduce((sum: number, m: any) => {
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
    const ownerUserId = await getOwnerUserId(userId);
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
              userId: ownerUserId,
            },
          },
        },
      },
      include: {
        movements: {
          where: { userId: ownerUserId },
        },
        mappings: {
          where: {
            account: {
              userId: ownerUserId,
            },
          },
          include: {
            account: {
              select: { name: true, userId: true },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    const stock = product.movements.reduce((sum: number, m: any) => {
      return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
    }, 0);

    res.json({
      id: product.id,
      sku: product.sku,
      ean: product.ean || '',
      name: product.name,
      price: product.salePrice || 0,
      stock,
      accountId: product.mappings[0]?.accountId || '',
      accountName: product.mappings[0]?.account?.name || '',
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
    const ownerUserId = await getOwnerUserId(userId);

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
          userId: ownerUserId,
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
    const ownerUserId = await getOwnerUserId(userId);

    // Verificar se o produto pertence ao usuário
    const product = await prisma.product.findFirst({
      where: {
        id,
        mappings: {
          some: {
            account: {
              userId: ownerUserId,
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
        where: { productId: id, userId: ownerUserId },
      });

      const currentStock = movements.reduce((sum: number, m: any) => {
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
            userId: ownerUserId,
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
    const ownerUserId = await getOwnerUserId(userId);

    // Verificar se o produto pertence ao usuário
    const product = await prisma.product.findFirst({
      where: {
        id,
        mappings: {
          some: {
            account: {
              userId: ownerUserId,
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
    const ownerUserId = await getOwnerUserId(userId);
    const { ownerPassword } = req.body;

    console.log(`Iniciando processo de zerar todo estoque para usuário: ${ownerUserId}`);
    console.log(`Senha fornecida: ${ownerPassword ? '[FORNECIDA]' : '[NÃO FORNECIDA]'}`);

    // Buscar informações do usuário dono
    const ownerUser = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
      },
    });

    if (!ownerUser) {
      console.log(`Dono não encontrado: ${ownerUserId}`);
      return res.status(404).json({ error: 'Dono da conta não encontrado' });
    }

    console.log(`Dono identificado: ${ownerUser.username} (${ownerUser.name})`);

    // Validar senha do dono
    if (!ownerPassword) {
      console.log(`Senha não fornecida`);
      return res.status(400).json({ error: 'Senha do administrador é obrigatória' });
    }

    console.log(`Validando senha...`);
    const isPasswordValid = await bcrypt.compare(ownerPassword, ownerUser.password);

    if (!isPasswordValid) {
      console.log(`Senha incorreta para o dono: ${ownerUser.username}`);
      return res.status(403).json({ 
        error: 'Senha do administrador incorreta',
        ownerName: ownerUser.name 
      });
    }

    console.log(`Senha validada com sucesso para: ${ownerUser.username}`);

    // Buscar todos os produtos do usuário
    console.log(`Buscando produtos do usuário...`);
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

    if (products.length === 0) {
      console.log(`Nenhum produto encontrado para o usuário`);
      return res.json({
        success: true,
        message: 'Nenhum produto encontrado para zerar',
        processed: 0,
        zeroed: 0,
      });
    }

    let processedCount = 0;
    let zeroedCount = 0;
    let errorCount = 0;

    // Processar cada produto
    for (const product of products) {
      try {
        console.log(`Processando produto: ${product.name} (${product.sku})`);
        
        // Calcular estoque atual
        const currentStock = product.movements.reduce((sum: number, m: any) => {
          return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
        }, 0);

        console.log(`Estoque atual do produto ${product.name}: ${currentStock}`);

        // Se tem estoque, criar movimento para zerar
        if (currentStock !== 0) {
          console.log(`Criando movimento para zerar produto ${product.name}`);
          
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
        } else {
          console.log(`Produto ${product.name} já está com estoque zero`);
        }

        processedCount++;
      } catch (productError) {
        console.error(`Erro ao zerar produto ${product.name}:`, productError);
        errorCount++;
      }
    }

    console.log(`Processo concluído: ${processedCount} produtos processados, ${zeroedCount} estoques zerados, ${errorCount} erros`);

    res.json({
      success: true,
      message: `${zeroedCount} produtos tiveram o estoque zerado`,
      processed: processedCount,
      zeroed: zeroedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('Erro geral ao zerar todo estoque:', error);
    res.status(500).json({ error: 'Erro ao zerar estoque: ' + (error as Error).message });
  }
});

export default router;
