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

    // Não importar estoque do Bling - todos os produtos começam com estoque zerado
    console.log('📦 Produtos serão importados com estoque zerado');

    let imported = 0;
    let updated = 0;

    for (const bp of allProducts) {
      try {
        // Aguardar 200ms entre produtos para evitar rate limiting
        if (allProducts.indexOf(bp) > 0) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const sku = bp.codigo || String(bp.id);
        
        // Buscar detalhes do produto individual para obter EAN/GTIN
        let ean = bp.gtin || bp.codigoBarras || null;
        if (!ean) {
          try {
            // Aguardar 300ms antes de buscar detalhes para evitar rate limiting
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const detailResponse = await axios.get(`${BLING_API_URL}/produtos/${bp.id}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
              },
            });
            const productDetail = detailResponse.data?.data;
            ean = productDetail?.gtin || productDetail?.codigoBarras || productDetail?.codigo_barras || null;
          } catch (detailError) {
            // Se falhar, continua sem EAN
            console.log(`⚠️ Não foi possível buscar detalhes do produto ${bp.id}`);
          }
        }

        // Buscar produto existente por SKU, EAN ou nome (evitar duplicatas)
        let existing = await prisma.product.findUnique({
          where: { sku },
        });

        // Se não encontrou por SKU, tenta por EAN
        if (!existing && ean) {
          existing = await prisma.product.findFirst({
            where: { ean },
          });
        }

        // Se não encontrou por SKU nem EAN, tenta por nome similar
        if (!existing) {
          existing = await prisma.product.findFirst({
            where: { 
              name: {
                equals: bp.nome,
                mode: 'insensitive'
              }
            },
          });
        }

        if (!existing) {
          // Create new product with zero stock
          const product = await prisma.product.create({
            data: {
              sku,
              ean,
              name: bp.nome,
              salePrice: bp.preco || 0,
              isActive: true,
            },
          });

          // Create mapping
          await prisma.productMapping.create({
            data: {
              productId: product.id,
              accountId: id,
              blingProductId: String(bp.id),
              blingSku: sku,
            },
          });

          console.log(`✅ Produto NOVO criado: ${bp.nome} (SKU: ${sku})`);
          imported++;
        } else {
          // Update existing product (não mexe no estoque)
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: bp.nome,
              ean: ean || existing.ean, // Atualiza EAN se existir
              salePrice: bp.preco || 0,
              sku: sku || existing.sku, // Atualiza SKU se necessário
            },
          });

          // Verificar se já existe mapping para esta conta
          const existingMapping = await prisma.productMapping.findFirst({
            where: {
              productId: existing.id,
              accountId: id,
            },
          });

          // Se não existe mapping, criar (produto existe mas veio de outra conta)
          if (!existingMapping) {
            await prisma.productMapping.create({
              data: {
                productId: existing.id,
                accountId: id,
                blingProductId: String(bp.id),
                blingSku: sku,
              },
            });
            console.log(`🔗 Mapping criado para produto existente: ${bp.nome} (conta: ${account.name})`);
          }

          console.log(`🔄 Produto ATUALIZADO: ${bp.nome} (SKU: ${sku})`);
          updated++;
        }
      } catch (productError) {
        console.log(`⚠️ Erro ao processar produto`);
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

    console.log(`✅ Sincronização: ${imported} novos, ${updated} atualizados`);
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

export default router;
