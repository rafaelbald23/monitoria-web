import { Router, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const BLING_API_URL = 'https://www.bling.com.br/Api/v3';

// List accounts
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const accounts = await prisma.blingAccount.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    res.json(accounts.map(a => ({
      id: a.id,
      name: a.name,
      clientId: a.clientId,
      clientSecret: a.clientSecret ? '***' : '',
      isActive: a.isActive,
      syncStatus: a.syncStatus,
      lastSync: a.lastSync?.toISOString(),
    })));
  } catch (error) {
    console.error('Erro ao listar contas:', error);
    res.status(500).json({ error: 'Erro ao listar contas' });
  }
});

// Create account
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, clientId, clientSecret } = req.body;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.create({
      data: {
        name,
        userId,
        clientId: clientId || '',
        clientSecret: clientSecret || '',
        isActive: true,
      },
    });

    res.json({ id: account.id, name: account.name });
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

// Update account
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, clientId, clientSecret } = req.body;
    const userId = req.user!.userId;

    // Verificar se a conta pertence ao usuário
    const account = await prisma.blingAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    await prisma.blingAccount.update({
      where: { id },
      data: {
        name,
        clientId: clientId || '',
        clientSecret: clientSecret || '',
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    res.status(500).json({ error: 'Erro ao atualizar conta' });
  }
});

// Delete account
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Verificar se a conta pertence ao usuário
    const account = await prisma.blingAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.status(404).json({ error: 'Conta não encontrada' });
    }

    await prisma.blingAccount.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// Sync account with Bling
router.post('/:id/sync', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return res.json({ success: false, error: 'Conta não encontrada' });
    }

    if (!account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada. Clique em "Conectar Bling" primeiro.' });
    }

    // Verificar se é a primeira sincronização desta conta
    const isFirstSync = !account.lastSync;
    console.log(`Sincronização da conta ${account.name}: ${isFirstSync ? 'PRIMEIRA' : 'SUBSEQUENTE'}`);

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      accessToken = await refreshAccessToken(account);
    }

    // Fetch all products from Bling with pagination
    let allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      console.log(`📦 Buscando página ${page}...`);

      const response = await axios.get(`${BLING_API_URL}/produtos?limite=100&pagina=${page}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      const products = response.data?.data || [];
      allProducts = allProducts.concat(products);

      if (products.length < 100) {
        hasMore = false;
      } else {
        page++;
      }

      if (page > 50) hasMore = false;
    }

    console.log(`📦 Total de produtos encontrados: ${allProducts.length}`);

    let imported = 0;
    let updated = 0;

    for (const bp of allProducts) {
      try {
        const sku = bp.codigo || String(bp.id);
        const ean = bp.gtin || bp.ean || null;
        const nomeNormalizado = bp.nome?.trim().toLowerCase() || '';
        
        console.log(`🔍 Processando: SKU="${sku}", EAN="${ean}", Nome="${bp.nome}"`);
        
        // ESTRATÉGIA ANTI-DUPLICAÇÃO MELHORADA
        let existing: any = null;
        
        // 1. Buscar por SKU exato
        existing = await prisma.product.findUnique({
          where: { sku },
        });
        
        if (existing) {
          console.log(`✅ Produto encontrado por SKU: ${existing.name}`);
        }
        
        // 2. Se não encontrou por SKU, buscar por EAN (se disponível)
        if (!existing && ean) {
          existing = await prisma.product.findFirst({
            where: { ean },
          });
          
          if (existing) {
            console.log(`✅ Produto encontrado por EAN: ${existing.name}`);
          }
        }
        
        // 3. Se não encontrou por SKU/EAN, buscar por nome normalizado
        if (!existing && nomeNormalizado) {
          existing = await prisma.product.findFirst({
            where: { 
              name: {
                contains: bp.nome.trim()
              }
            },
          });
          
          if (existing) {
            console.log(`✅ Produto encontrado por nome: ${existing.name}`);
          }
        }
        
        // 4. Busca por similaridade de nome (últimos 80% do nome)
        if (!existing && nomeNormalizado.length > 5) {
          const allProducts = await prisma.product.findMany({
            select: { id: true, name: true, sku: true, ean: true }
          });
          
          existing = allProducts.find((p: any) => {
            const productName = p.name.toLowerCase().trim();
            // Verifica se um nome contém o outro (80% de match)
            const minLength = Math.min(productName.length, nomeNormalizado.length);
            const matchThreshold = minLength * 0.8;
            
            if (productName.includes(nomeNormalizado) || nomeNormalizado.includes(productName)) {
              return true;
            }
            
            // Verifica palavras-chave em comum
            const words1 = productName.split(/\s+/).filter((w: string) => w.length > 3);
            const words2 = nomeNormalizado.split(/\s+/).filter((w: string) => w.length > 3);
            const commonWords = words1.filter((w: string) => words2.includes(w));
            
            return commonWords.length >= Math.min(words1.length, words2.length) * 0.7;
          });
          
          if (existing) {
            console.log(`✅ Produto encontrado por similaridade: ${existing.name}`);
          }
        }

        if (!existing) {
          // CRIAR NOVO PRODUTO apenas se realmente não existe
          console.log(`➕ Criando novo produto: ${bp.nome}`);
          
          const product = await prisma.product.create({
            data: {
              sku,
              ean: ean,
              name: bp.nome.trim(),
              salePrice: bp.preco || 0,
              isActive: true,
            },
          });

          // Criar mapping para esta conta
          await prisma.productMapping.create({
            data: {
              productId: product.id,
              accountId: id,
              blingProductId: String(bp.id),
              blingSku: sku,
            },
          });

          imported++;
        } else {
          // Produto já existe - verificar se precisa criar mapping
          const existingMapping = await prisma.productMapping.findFirst({
            where: {
              productId: existing.id,
              accountId: id,
            },
          });

          if (!existingMapping) {
            // Nova conexão Bling para produto existente
            console.log(`Produto ${existing.name} já existe - criando mapping para conta ${account.name}`);
            
            // APENAS na primeira sincronização desta conta, zerar estoque de produtos existentes
            if (isFirstSync) {
              console.log(`PRIMEIRA SYNC: Zerando estoque do produto ${existing.name}`);
              
              // Calcular estoque atual
              const movements = await prisma.movement.findMany({
                where: { 
                  productId: existing.id,
                  userId: userId 
                },
              });

              const currentStock = movements.reduce((sum, m) => {
                return m.type === 'ENTRY' ? sum + m.quantity : sum - m.quantity;
              }, 0);

              // Se tem estoque, criar movimento para zerar
              if (currentStock !== 0) {
                await prisma.movement.create({
                  data: {
                    type: currentStock > 0 ? 'EXIT' : 'ENTRY',
                    productId: existing.id,
                    quantity: Math.abs(currentStock),
                    reason: `Zerado na primeira sincronização da conta ${account.name}`,
                    userId: userId,
                    syncStatus: 'completed',
                  },
                });
                console.log(`Estoque zerado: ${currentStock} → 0`);
              }
            } else {
              console.log(`SYNC SUBSEQUENTE: Mantendo estoque atual do produto ${existing.name}`);
            }

            // Criar mapping
            await prisma.productMapping.create({
              data: {
                productId: existing.id,
                accountId: id,
                blingProductId: String(bp.id),
                blingSku: sku,
              },
            });
          }

          updated++;
        }

        // Delay para respeitar rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (productError) {
        console.log(`⚠️ Erro ao processar produto ${bp.nome || bp.id}`);
      }
    }

    // Update last sync
    await prisma.blingAccount.update({
      where: { id },
      data: {
        lastSync: new Date(),
        syncStatus: 'connected',
      },
    });

    res.json({ success: true, imported, updated, total: allProducts.length });
  } catch (error: any) {
    console.error('❌ Erro ao sincronizar:', error.response?.data || error.message);
    res.json({ success: false, error: error.response?.data?.error?.message || 'Erro ao sincronizar produtos' });
  }
});

async function refreshAccessToken(account: any): Promise<string> {
  const credentials = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');

  const response = await axios.post(
    'https://www.bling.com.br/Api/v3/oauth/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  const tokens = response.data;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  await prisma.blingAccount.update({
    where: { id: account.id },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: expiresAt,
    },
  });

  return tokens.access_token;
}

// Rota para limpar produtos duplicados
router.post('/cleanup-duplicates', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    
    console.log('🧹 Iniciando limpeza de produtos duplicados para usuário:', userId);
    
    // Buscar todos os produtos do usuário
    const allProducts = await prisma.product.findMany({
      include: {
        movements: {
          where: { userId },
          orderBy: { createdAt: 'asc' }
        },
        mappings: true,
      }
    });
    
    console.log(`📦 Total de produtos: ${allProducts.length}`);
    
    // Agrupar produtos por nome normalizado
    const productsByName = new Map<string, typeof allProducts>();
    
    for (const product of allProducts) {
      const normalizedName = product.name.toLowerCase().trim();
      
      if (!productsByName.has(normalizedName)) {
        productsByName.set(normalizedName, []);
      }
      
      productsByName.get(normalizedName)!.push(product);
    }
    
    let duplicatesFound = 0;
    let duplicatesRemoved = 0;
    const mergeLog: string[] = [];
    
    // Processar grupos com duplicatas
    for (const [name, products] of productsByName.entries()) {
      if (products.length > 1) {
        duplicatesFound += products.length - 1;
        console.log(`\n🔍 Duplicatas encontradas para "${name}": ${products.length} produtos`);
        
        // Ordenar por: 1) tem movimentos, 2) mais antigo
        products.sort((a, b) => {
          if (a.movements.length !== b.movements.length) {
            return b.movements.length - a.movements.length; // Mais movimentos primeiro
          }
          return a.createdAt.getTime() - b.createdAt.getTime(); // Mais antigo primeiro
        });
        
        const keepProduct = products[0]; // Manter o primeiro (com mais movimentos ou mais antigo)
        const duplicates = products.slice(1); // Remover os demais
        
        console.log(`✅ Mantendo: ${keepProduct.name} (SKU: ${keepProduct.sku}, Movimentos: ${keepProduct.movements.length})`);
        
        for (const duplicate of duplicates) {
          console.log(`❌ Removendo: ${duplicate.name} (SKU: ${duplicate.sku}, Movimentos: ${duplicate.movements.length})`);
          
          try {
            // Transferir movimentos do duplicado para o produto principal
            if (duplicate.movements.length > 0) {
              await prisma.movement.updateMany({
                where: { productId: duplicate.id },
                data: { productId: keepProduct.id }
              });
              console.log(`  ↪️ ${duplicate.movements.length} movimentos transferidos`);
            }
            
            // Transferir mappings
            if (duplicate.mappings.length > 0) {
              for (const mapping of duplicate.mappings) {
                // Verificar se já existe mapping para esta conta
                const existingMapping = await prisma.productMapping.findFirst({
                  where: {
                    productId: keepProduct.id,
                    accountId: mapping.accountId,
                  }
                });
                
                if (!existingMapping) {
                  await prisma.productMapping.update({
                    where: { id: mapping.id },
                    data: { productId: keepProduct.id }
                  });
                  console.log(`  ↪️ Mapping transferido`);
                } else {
                  await prisma.productMapping.delete({
                    where: { id: mapping.id }
                  });
                  console.log(`  ↪️ Mapping duplicado removido`);
                }
              }
            }
            
            // Deletar produto duplicado
            await prisma.product.delete({
              where: { id: duplicate.id }
            });
            
            duplicatesRemoved++;
            mergeLog.push(`Mesclado: "${duplicate.name}" (${duplicate.sku}) → "${keepProduct.name}" (${keepProduct.sku})`);
            
          } catch (deleteError: any) {
            console.error(`  ⚠️ Erro ao remover duplicado: ${deleteError.message}`);
          }
        }
      }
    }
    
    console.log(`\n🎉 Limpeza concluída:`);
    console.log(`   - Duplicatas encontradas: ${duplicatesFound}`);
    console.log(`   - Duplicatas removidas: ${duplicatesRemoved}`);
    
    res.json({
      success: true,
      duplicatesFound,
      duplicatesRemoved,
      mergeLog,
      message: `${duplicatesRemoved} produtos duplicados foram mesclados com sucesso!`
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao limpar duplicados:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao limpar produtos duplicados',
      details: error.message 
    });
  }
});

export default router;
