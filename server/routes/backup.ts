import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Criar backup completo dos dados do usuário
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    console.log(`📦 Iniciando backup para usuário: ${userId}`);

    // Buscar todos os dados do usuário
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        companyName: true,
        phone: true,
        permissions: true,
        createdAt: true,
      }
    });

    if (!userData) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Buscar contas Bling (sem tokens por segurança)
    const blingAccounts = await prisma.blingAccount.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        clientId: true,
        isActive: true,
        syncStatus: true,
        lastSync: true,
        createdAt: true,
      }
    });

    // Buscar produtos
    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        ean: true,
        internalCode: true,
        name: true,
        description: true,
        unit: true,
        minimumStock: true,
        category: true,
        costPrice: true,
        salePrice: true,
        profitMargin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Buscar mapeamentos de produtos
    const productMappings = await prisma.productMapping.findMany({
      where: {
        account: {
          userId: userId
        }
      },
      select: {
        id: true,
        productId: true,
        accountId: true,
        blingProductId: true,
        blingSku: true,
        createdAt: true,
      }
    });

    // Buscar movimentações
    const movements = await prisma.movement.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        productId: true,
        accountId: true,
        quantity: true,
        previousQty: true,
        newQty: true,
        reason: true,
        supplier: true,
        customer: true,
        notes: true,
        relatedMovement: true,
        saleId: true,
        createdAt: true,
      }
    });

    // Buscar clientes
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        documentType: true,
        document: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        notes: true,
        blingCustomerId: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    // Buscar vendas
    const sales = await prisma.sale.findMany({
      where: { userId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            totalPrice: true,
          }
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            installments: true,
            installmentValue: true,
            paidAt: true,
          }
        }
      }
    });

    // Buscar reservas
    const reservations = await prisma.reservation.findMany({
      where: { userId },
      select: {
        id: true,
        productId: true,
        customerId: true,
        quantity: true,
        expiresAt: true,
        status: true,
        notes: true,
        createdAt: true,
      }
    });

    // Buscar histórico de preços
    const priceHistory = await prisma.priceHistory.findMany({
      where: { userId },
      select: {
        id: true,
        productId: true,
        costPrice: true,
        salePrice: true,
        profitMargin: true,
        createdAt: true,
      }
    });

    // Buscar pedidos do Bling
    const blingOrders = await prisma.blingOrder.findMany({
      where: { userId },
      select: {
        id: true,
        blingOrderId: true,
        orderNumber: true,
        accountId: true,
        status: true,
        customerName: true,
        totalAmount: true,
        items: true,
        processedAt: true,
        isProcessed: true,
        createdAt: true,
        updatedAt: true,
        blingCreatedAt: true,
      }
    });

    // Montar objeto de backup
    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      userId: userId,
      userData,
      blingAccounts,
      products,
      productMappings,
      movements,
      customers,
      sales,
      reservations,
      priceHistory,
      blingOrders,
      summary: {
        products: products.length,
        movements: movements.length,
        customers: customers.length,
        sales: sales.length,
        blingAccounts: blingAccounts.length,
        reservations: reservations.length,
        blingOrders: blingOrders.length,
      }
    };

    console.log(`✅ Backup criado com sucesso:`, backupData.summary);

    res.json({
      success: true,
      backup: backupData,
      filename: `backup_${userData.username}_${new Date().toISOString().split('T')[0]}.json`
    });

  } catch (error) {
    console.error('❌ Erro ao criar backup:', error);
    res.status(500).json({ error: 'Erro ao criar backup' });
  }
});

// Restaurar backup
router.post('/restore', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { backupData, replaceExisting = false } = req.body;

    if (!backupData || !backupData.version) {
      return res.status(400).json({ error: 'Dados de backup inválidos' });
    }

    console.log(`🔄 Iniciando restauração para usuário: ${userId}`);
    console.log(`📊 Dados do backup:`, backupData.summary);

    let restored = {
      products: 0,
      customers: 0,
      movements: 0,
      sales: 0,
      blingAccounts: 0,
      reservations: 0,
      blingOrders: 0,
      skipped: 0,
      errors: 0
    };

    // Usar transação para garantir consistência
    await prisma.$transaction(async (tx) => {
      
      // 1. Restaurar produtos
      if (backupData.products && Array.isArray(backupData.products)) {
        for (const product of backupData.products) {
          try {
            const existing = await tx.product.findUnique({
              where: { sku: product.sku }
            });

            if (!existing || replaceExisting) {
              await tx.product.upsert({
                where: { sku: product.sku },
                create: {
                  ...product,
                  id: undefined, // Deixar o banco gerar novo ID
                },
                update: replaceExisting ? {
                  name: product.name,
                  description: product.description,
                  unit: product.unit,
                  minimumStock: product.minimumStock,
                  category: product.category,
                  costPrice: product.costPrice,
                  salePrice: product.salePrice,
                  profitMargin: product.profitMargin,
                  isActive: product.isActive,
                } : {}
              });
              restored.products++;
            } else {
              restored.skipped++;
            }
          } catch (error) {
            console.error(`❌ Erro ao restaurar produto ${product.sku}:`, error);
            restored.errors++;
          }
        }
      }

      // 2. Restaurar clientes
      if (backupData.customers && Array.isArray(backupData.customers)) {
        for (const customer of backupData.customers) {
          try {
            const existing = await tx.customer.findUnique({
              where: { document: customer.document }
            });

            if (!existing || replaceExisting) {
              await tx.customer.upsert({
                where: { document: customer.document },
                create: {
                  ...customer,
                  id: undefined,
                },
                update: replaceExisting ? {
                  name: customer.name,
                  documentType: customer.documentType,
                  email: customer.email,
                  phone: customer.phone,
                  address: customer.address,
                  city: customer.city,
                  state: customer.state,
                  zipCode: customer.zipCode,
                  notes: customer.notes,
                } : {}
              });
              restored.customers++;
            } else {
              restored.skipped++;
            }
          } catch (error) {
            console.error(`❌ Erro ao restaurar cliente ${customer.document}:`, error);
            restored.errors++;
          }
        }
      }

      // 3. Restaurar contas Bling (apenas estrutura, sem tokens)
      if (backupData.blingAccounts && Array.isArray(backupData.blingAccounts)) {
        for (const account of backupData.blingAccounts) {
          try {
            const existing = await tx.blingAccount.findFirst({
              where: { 
                name: account.name,
                userId: userId 
              }
            });

            if (!existing) {
              await tx.blingAccount.create({
                data: {
                  name: account.name,
                  userId: userId,
                  clientId: account.clientId || '',
                  clientSecret: '', // Não restaurar credenciais por segurança
                  isActive: account.isActive,
                  syncStatus: 'disconnected', // Forçar reconexão
                }
              });
              restored.blingAccounts++;
            } else {
              restored.skipped++;
            }
          } catch (error) {
            console.error(`❌ Erro ao restaurar conta Bling ${account.name}:`, error);
            restored.errors++;
          }
        }
      }

      // 4. Restaurar movimentações (apenas se replaceExisting for true)
      if (replaceExisting && backupData.movements && Array.isArray(backupData.movements)) {
        for (const movement of backupData.movements) {
          try {
            // Verificar se o produto existe
            const product = await tx.product.findUnique({
              where: { id: movement.productId }
            });

            if (product) {
              await tx.movement.create({
                data: {
                  ...movement,
                  id: undefined,
                  userId: userId,
                  syncStatus: 'restored',
                }
              });
              restored.movements++;
            }
          } catch (error) {
            console.error(`❌ Erro ao restaurar movimentação:`, error);
            restored.errors++;
          }
        }
      }

    });

    console.log(`✅ Restauração concluída:`, restored);

    res.json({
      success: true,
      restored,
      message: `Backup restaurado com sucesso! ${restored.products} produtos, ${restored.customers} clientes, ${restored.blingAccounts} contas Bling restauradas.`
    });

  } catch (error) {
    console.error('❌ Erro ao restaurar backup:', error);
    res.status(500).json({ error: 'Erro ao restaurar backup' });
  }
});

// Listar backups disponíveis (simulado - em produção seria de um storage)
router.get('/list', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Por enquanto, retorna informações básicas
    // Em produção, isso viria de um sistema de storage (AWS S3, etc.)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, createdAt: true }
    });

    const mockBackups = [
      {
        id: '1',
        filename: `backup_${user?.username}_${new Date().toISOString().split('T')[0]}.json`,
        createdAt: new Date().toISOString(),
        size: '2.5 MB',
        description: 'Backup automático diário'
      }
    ];

    res.json({ backups: mockBackups });
  } catch (error) {
    console.error('❌ Erro ao listar backups:', error);
    res.status(500).json({ error: 'Erro ao listar backups' });
  }
});

// Verificar se precisa fazer backup
router.get('/check-needed', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Por enquanto, sempre retorna que não precisa backup até implementarmos os campos
    // TODO: Implementar após migração dos campos de backup
    res.json({ needsBackup: false, reason: 'not_implemented' });

  } catch (error) {
    console.error('❌ Erro ao verificar necessidade de backup:', error);
    res.status(500).json({ error: 'Erro ao verificar backup' });
  }
});

// Atualizar data do último backup
router.post('/update-date', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Por enquanto, apenas retorna sucesso
    // TODO: Implementar após migração dos campos de backup
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar data do backup:', error);
    res.status(500).json({ error: 'Erro ao atualizar data do backup' });
  }
});

// Pular backup por 7 dias
router.post('/skip-7days', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Por enquanto, apenas retorna sucesso
    // TODO: Implementar após migração dos campos de backup
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao pular backup:', error);
    res.status(500).json({ error: 'Erro ao pular backup' });
  }
});

// Desabilitar backup automático
router.post('/disable-auto', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    // Por enquanto, apenas retorna sucesso
    // TODO: Implementar após migração dos campos de backup
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao desabilitar backup automático:', error);
    res.status(500).json({ error: 'Erro ao desabilitar backup automático' });
  }
});

// Criar backup de um cliente específico (para master)
router.post('/client/:clientId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { clientId } = req.params;
    const userId = req.user!.userId;

    // Verificar se é master
    const masterUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isMaster: true }
    });

    if (!masterUser?.isMaster) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Verificar se o cliente existe
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true, username: true, name: true }
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    console.log(`📦 Master criando backup para cliente: ${client.name} (${client.username})`);

    // Usar a mesma lógica do backup normal, mas para o cliente específico
    const userData = await prisma.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        companyName: true,
        phone: true,
        permissions: true,
        createdAt: true,
      }
    });

    // Buscar todos os dados do cliente (mesmo código do backup normal)
    const blingAccounts = await prisma.blingAccount.findMany({
      where: { userId: clientId },
      select: {
        id: true,
        name: true,
        clientId: true,
        isActive: true,
        syncStatus: true,
        lastSync: true,
        createdAt: true,
      }
    });

    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        ean: true,
        internalCode: true,
        name: true,
        description: true,
        unit: true,
        minimumStock: true,
        category: true,
        costPrice: true,
        salePrice: true,
        profitMargin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    const movements = await prisma.movement.findMany({
      where: { userId: clientId },
      select: {
        id: true,
        type: true,
        productId: true,
        accountId: true,
        quantity: true,
        previousQty: true,
        newQty: true,
        reason: true,
        supplier: true,
        customer: true,
        notes: true,
        relatedMovement: true,
        saleId: true,
        createdAt: true,
      }
    });

    const sales = await prisma.sale.findMany({
      where: { userId: clientId },
      include: {
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            totalPrice: true,
          }
        },
        payments: {
          select: {
            id: true,
            method: true,
            amount: true,
            installments: true,
            installmentValue: true,
            paidAt: true,
          }
        }
      }
    });

    // Montar objeto de backup
    const backupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      createdBy: 'master',
      userId: clientId,
      userData,
      blingAccounts,
      products,
      movements,
      sales,
      summary: {
        products: products.length,
        movements: movements.length,
        sales: sales.length,
        blingAccounts: blingAccounts.length,
      }
    };

    // Atualizar data do último backup do cliente
    // TODO: Implementar após migração dos campos de backup
    // await prisma.user.update({
    //   where: { id: clientId },
    //   data: { lastBackupAt: new Date() }
    // });

    console.log(`✅ Backup do cliente criado:`, backupData.summary);

    res.json({
      success: true,
      backup: backupData,
      filename: `backup_${client.username}_master_${new Date().toISOString().split('T')[0]}.json`,
      clientName: client.name
    });

  } catch (error) {
    console.error('❌ Erro ao criar backup do cliente:', error);
    res.status(500).json({ error: 'Erro ao criar backup do cliente' });
  }
});

export default router;