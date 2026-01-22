import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

// Função auxiliar para buscar detalhes completos de um pedido
async function fetchOrderDetails(orderId: string, accessToken: string): Promise<any> {
  const BLING_API_URL = 'https://www.bling.com.br/Api/v3';
  
  try {
    console.log(`🔍 Buscando detalhes completos do pedido #${orderId}...`);
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });
    
    if (response.data?.data) {
      console.log(`✅ Detalhes completos obtidos com ${(response.data.data.itens || []).length} itens`);
      return response.data.data;
    }
  } catch (error: any) {
    console.log(`⚠️ Erro ao buscar detalhes: ${error.message}`);
  }
  
  return null;
}

// Detecta automaticamente a URL base
function getRedirectUri(req: Request): string {
  // Prioridade: variável de ambiente > headers > fallback
  if (process.env.BLING_REDIRECT_URI) {
    console.log('Usando BLING_REDIRECT_URI do env:', process.env.BLING_REDIRECT_URI);
    return process.env.BLING_REDIRECT_URI;
  }
  
  // Para Railway e outros proxies reversos
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001';
  const redirectUri = `${protocol}://${host}/api/bling/callback`;
  console.log('Redirect URI gerado automaticamente:', redirectUri);
  return redirectUri;
}

// Store pending OAuth states
const pendingStates = new Map<string, { accountId: string; userId: string; timestamp: number }>();

// Clean old states every minute
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000);

// Start OAuth flow
router.post('/start-oauth', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.body;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.clientId || !account.clientSecret) {
      return res.json({ success: false, error: 'Configure o Client ID e Client Secret primeiro!' });
    }

    // Generate state
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    pendingStates.set(state, { accountId, userId, timestamp: Date.now() });

    const redirectUri = getRedirectUri(req);
    console.log('Redirect URI:', redirectUri);
    
    const authUrl = `${BLING_AUTH_URL}?response_type=code&client_id=${account.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({ success: true, authUrl });
  } catch (error: any) {
    console.error('Erro ao iniciar OAuth:', error);
    res.json({ success: false, error: error.message });
  }
});

// OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">Erro</h1>
            <p>${error}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }

    const pendingData = pendingStates.get(state as string);
    if (!pendingData) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">Erro</h1>
            <p>State inválido ou expirado</p>
          </body>
        </html>
      `);
    }

    const { accountId } = pendingData;
    pendingStates.delete(state as string);

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">Erro</h1>
            <p>Conta não encontrada</p>
          </body>
        </html>
      `);
    }

    // Exchange code for tokens
    const credentials = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');
    const redirectUri = getRedirectUri(req);

    const tokenResponse = await axios.post(
      BLING_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const tokens = tokenResponse.data;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Save tokens
    await prisma.blingAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        isActive: true,
        syncStatus: 'connected',
      },
    });

    res.send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;min-height:100vh;margin:0;">
          <div style="background:white;color:#333;padding:40px;border-radius:20px;display:inline-block;margin-top:50px;">
            <h1 style="color:#22c55e;">Conectado!</h1>
            <p>Pode fechar esta janela e voltar ao sistema.</p>
            <script>
              setTimeout(() => {
                window.opener?.postMessage({ type: 'BLING_OAUTH_SUCCESS', accountId: '${accountId}' }, '*');
                window.close();
              }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Erro no callback OAuth:', error.response?.data || error.message);
    res.send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:50px;">
          <h1 style="color:red;">Erro</h1>
          <p>${error.response?.data?.error_description || error.message}</p>
        </body>
      </html>
    `);
  }
});

// Check auth status
router.get('/check-auth/:accountId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
      select: {
        isActive: true,
        tokenExpiresAt: true,
        syncStatus: true,
      },
    });

    if (!account) {
      return res.json({ authenticated: false });
    }

    const isValid =
      account.isActive &&
      account.tokenExpiresAt &&
      account.tokenExpiresAt > new Date();

    res.json({ authenticated: isValid, syncStatus: account.syncStatus });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

const BLING_API_URL = 'https://www.bling.com.br/Api/v3';

// TESTE: Forçar sincronização de um pedido específico
router.post('/force-sync-order/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const userId = req.user!.userId;

    console.log(`🔧 FORÇA SINCRONIZAÇÃO: Pedido #${orderNumber} da conta ${accountId}`);

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    // Buscar pedido específico na API do Bling
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const orders = response.data?.data || [];
    const targetOrder = orders.find((o: any) => String(o.numero) === orderNumber || String(o.id) === orderNumber);

    if (!targetOrder) {
      return res.json({ success: false, error: 'Pedido não encontrado na API do Bling' });
    }

    // Aplicar a mesma lógica de mapeamento do código principal
    const situacao = targetOrder.situacao || {};
    const statusId = situacao.id;
    
    console.log(`📋 FORÇA SYNC - Pedido #${targetOrder.numero}:`);
    console.log(`   - situacao completa:`, JSON.stringify(situacao, null, 2));
    
    const possibleStatusFields = [
      situacao.nome,
      situacao.descricao,
      situacao.valor,
      situacao.texto,
      situacao.status,
      situacao.situacao,
      targetOrder.status,
      targetOrder.situacao_nome,
      targetOrder.situacao_descricao,
      situacao.situacao?.nome,
      situacao.situacao?.descricao,
      situacao.situacao?.valor,
    ];
    
    let statusTexto = '';
    let foundField = '';
    
    for (let i = 0; i < possibleStatusFields.length; i++) {
      const field = possibleStatusFields[i];
      if (field && typeof field === 'string' && field.trim().length > 0) {
        statusTexto = field.trim();
        foundField = `campo ${i + 1}`;
        break;
      }
    }
    
    console.log(`   - statusId: ${statusId}`);
    console.log(`   - statusTexto encontrado: "${statusTexto}" (${foundField})`);
    
    const statusMap: Record<number, string> = {
      0: 'Em Aberto', 1: 'Atendido', 2: 'Cancelado', 3: 'Em Andamento', 4: 'Venda Agenciada',
      5: 'Verificado', 6: 'Aguardando', 7: 'Não Entregue', 8: 'Entregue', 9: 'Em Digitação',
      10: 'Checado', 11: 'Enviado', 12: 'Pronto para Envio', 13: 'Pendente', 14: 'Faturado',
      15: 'Pronto', 16: 'Impresso', 17: 'Separado', 18: 'Embalado', 19: 'Coletado',
      20: 'Em Trânsito', 21: 'Devolvido', 22: 'Extraviado', 23: 'Tentativa de Entrega',
      24: 'Verificado', // CORREÇÃO: Era "Reagendado", agora é "Verificado"
      25: 'Bloqueado', 26: 'Suspenso', 27: 'Processando',
      28: 'Aprovado', 29: 'Reprovado', 30: 'Estornado',
    };

    let status: string;
    if (statusTexto && statusTexto.length > 0) {
      status = statusTexto;
      console.log(`✅ Status capturado pelo TEXTO: "${status}"`);
    } else if (statusId !== undefined && statusMap[statusId]) {
      status = statusMap[statusId];
      console.log(`✅ Status mapeado pelo ID ${statusId}: "${status}"`);
    } else if (statusId !== undefined) {
      status = `Status ${statusId}`;
      console.log(`⚠️ Status não mapeado, usando ID: "${status}"`);
    } else {
      status = 'Aguardando Processamento';
      console.log(`❌ Nenhum status encontrado, usando padrão: "${status}"`);
    }
    
    console.log(`🎯 STATUS FINAL DEFINIDO: "${status}"`);
    
    // Verificar se precisa de baixa automática
    const statusNormalized = status.toLowerCase().trim();
    const statusParaBaixa = [
      'verificado', 'checado', 'aprovado', 'pronto para envio',
      'verified', 'checked', 'approved', 'ready to ship'
    ];
    const needsProcessing = statusParaBaixa.includes(statusNormalized);
    
    if (needsProcessing) {
      console.log(`🚀 PEDIDO MARCADO PARA BAIXA AUTOMÁTICA: #${targetOrder.numero} - Status: "${status}"`);
    }

    // Processar data
    let blingCreatedAt: Date | null = null;
    if (targetOrder.data) {
      if (typeof targetOrder.data === 'string' && targetOrder.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
        blingCreatedAt = new Date(targetOrder.data + 'T12:00:00.000Z');
      } else {
        blingCreatedAt = new Date(targetOrder.data);
      }
    }

    // Salvar/atualizar no banco
    console.log(`📦 ITENS DO PEDIDO #${targetOrder.numero}:`, JSON.stringify(targetOrder.itens || [], null, 2));
    console.log(`📦 Total de itens: ${(targetOrder.itens || []).length}`);
    
    const savedOrder = await prisma.blingOrder.upsert({
      where: {
        blingOrderId_accountId: {
          blingOrderId: String(targetOrder.id),
          accountId: accountId,
        },
      },
      update: {
        status: status,
        customerName: targetOrder.contato?.nome || null,
        totalAmount: targetOrder.total || 0,
        items: JSON.stringify(targetOrder.itens || []),
        updatedAt: new Date(),
        // Se mudou para status que precisa de baixa, resetar processamento
        isProcessed: needsProcessing ? false : undefined,
      },
      create: {
        blingOrderId: String(targetOrder.id),
        orderNumber: String(targetOrder.numero || targetOrder.id),
        accountId,
        userId,
        status: status,
        customerName: targetOrder.contato?.nome || null,
        totalAmount: targetOrder.total || 0,
        items: JSON.stringify(targetOrder.itens || []),
        blingCreatedAt,
        isProcessed: false,
      },
    });

    // Processar baixa automática se necessário
    let autoProcessed = false;
    if (needsProcessing && !savedOrder.isProcessed) {
      console.log(`🔥 PROCESSANDO BAIXA AUTOMÁTICA FORÇADA para pedido #${targetOrder.numero}`);
      
      const items = targetOrder.itens || [];
      let produtosProcessados = 0;

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const sku = item.codigo || item.produto?.codigo;
          const quantidade = item.quantidade || 1;
          
          if (!sku) continue;

          const product = await tx.product.findUnique({
            where: { sku },
          });

          if (product) {
            console.log(`📦 BAIXA FORÇADA: ${quantidade}x ${product.name} (SKU: ${sku})`);
            
            await tx.movement.create({
              data: {
                type: 'EXIT',
                productId: product.id,
                quantity: quantidade,
                reason: `Baixa automática FORÇADA - Pedido #${targetOrder.numero} (${status})`,
                userId,
                syncStatus: 'synced',
              },
            });
            
            produtosProcessados++;
          }
        }

        // Marcar como processado
        await tx.blingOrder.update({
          where: { id: savedOrder.id },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
      });

      autoProcessed = true;
      console.log(`✅ BAIXA FORÇADA CONCLUÍDA: ${produtosProcessados} produtos processados`);
    }

    res.json({ 
      success: true, 
      message: `Pedido #${targetOrder.numero} sincronizado com status "${status}"${autoProcessed ? ' e baixa processada automaticamente' : ''}`,
      debug: {
        statusTexto,
        foundField,
        finalStatus: status,
        needsProcessing,
        autoProcessed,
        statusNormalized,
        statusParaBaixa,
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na sincronização forçada:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// SOLUÇÃO DEFINITIVA: Rota para forçar atualização de status específico
router.post('/force-update-status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orderNumber, newStatus } = req.body;
    const userId = req.user!.userId;

    console.log(`🔧 FORÇA ATUALIZAÇÃO: Pedido #${orderNumber} para status "${newStatus}"`);

    // Buscar o pedido no banco
    const order = await prisma.blingOrder.findFirst({
      where: {
        orderNumber: String(orderNumber),
        userId,
      },
    });

    if (!order) {
      return res.json({ success: false, error: 'Pedido não encontrado' });
    }

    // Atualizar status forçadamente
    const updatedOrder = await prisma.blingOrder.update({
      where: { id: order.id },
      data: {
        status: newStatus,
        isProcessed: newStatus === 'Verificado' ? false : order.isProcessed,
        updatedAt: new Date(),
      },
    });

    // Se mudou para "Verificado", processar baixa automática
    if (newStatus === 'Verificado' && !updatedOrder.isProcessed) {
      console.log(`🔥 PROCESSANDO BAIXA AUTOMÁTICA FORÇADA para pedido #${orderNumber}`);
      
      const items = JSON.parse(order.items);
      let produtosProcessados = 0;

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const sku = item.codigo || item.produto?.codigo;
          const quantidade = item.quantidade || 1;
          
          if (!sku) continue;

          const product = await tx.product.findUnique({
            where: { sku },
          });

          if (product) {
            console.log(`📦 BAIXA FORÇADA: ${quantidade}x ${product.name} (SKU: ${sku})`);
            
            await tx.movement.create({
              data: {
                type: 'EXIT',
                productId: product.id,
                quantity: quantidade,
                reason: `Baixa automática FORÇADA - Pedido #${orderNumber} (${newStatus})`,
                userId,
                syncStatus: 'synced',
              },
            });
            
            produtosProcessados++;
          }
        }

        // Marcar como processado
        await tx.blingOrder.update({
          where: { id: order.id },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
      });

      console.log(`✅ BAIXA FORÇADA CONCLUÍDA: ${produtosProcessados} produtos processados`);
    }

    res.json({ 
      success: true, 
      message: `Status atualizado para "${newStatus}"${newStatus === 'Verificado' ? ' e baixa processada' : ''}`,
      order: updatedOrder 
    });

  } catch (error: any) {
    console.error('❌ Erro na atualização forçada:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// CORRESPONDÊNCIA DE PRODUTOS: Buscar produtos no estoque que correspondem aos itens do Bling
router.post('/match-products', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    const userId = req.user!.userId;

    if (!items || !Array.isArray(items)) {
      return res.json({ success: false, error: 'Itens não fornecidos' });
    }

    console.log(`🔍 BUSCANDO CORRESPONDÊNCIAS para ${items.length} itens`);

    const matches: Record<string, any> = {};

    // Buscar todos os produtos do usuário
    const products = await prisma.product.findMany({
      where: { 
        // Buscar produtos do usuário ou do owner se for funcionário
        OR: [
          { movements: { some: { userId } } },
          { movements: { some: { user: { ownerId: userId } } } },
          { movements: { some: { user: { id: userId } } } }
        ]
      },
      include: {
        movements: {
          where: { type: 'ENTRY' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Calcular estoque atual para cada produto
    const productsWithStock = await Promise.all(
      products.map(async (product) => {
        const movements = await prisma.movement.findMany({
          where: { productId: product.id },
          orderBy: { createdAt: 'asc' },
        });

        let currentStock = 0;
        movements.forEach(movement => {
          if (movement.type === 'ENTRY') {
            currentStock += movement.quantity;
          } else if (movement.type === 'EXIT') {
            currentStock -= movement.quantity;
          }
        });

        return {
          ...product,
          currentStock,
        };
      })
    );

    // Para cada item do Bling, tentar encontrar correspondência
    for (const item of items) {
      const sku = item.codigo || item.produto?.codigo;
      const nome = item.nome || item.produto?.nome;
      const ean = item.ean || item.produto?.ean;

      console.log(`🔍 Buscando: SKU="${sku}", Nome="${nome}", EAN="${ean}"`);

      let match: any = null;

      // 1. Buscar por SKU exato
      if (sku) {
        match = productsWithStock.find(p => 
          p.sku === sku || 
          p.internalCode === sku
        );
        if (match) {
          console.log(`✅ Encontrado por SKU: ${match.name}`);
          matches[sku] = match;
          continue;
        }
      }

      // 2. Buscar por EAN exato
      if (ean) {
        match = productsWithStock.find(p => p.ean === ean);
        if (match) {
          console.log(`✅ Encontrado por EAN: ${match.name}`);
          matches[ean] = match;
          continue;
        }
      }

      // 3. Buscar por nome (similaridade)
      if (nome) {
        const nomeNormalizado = nome.toLowerCase().trim();
        
        // Busca exata por nome
        match = productsWithStock.find(p => 
          p.name.toLowerCase().trim() === nomeNormalizado
        );
        
        if (!match) {
          // Busca por similaridade (contém)
          match = productsWithStock.find(p => {
            const productName = p.name.toLowerCase().trim();
            return productName.includes(nomeNormalizado) || 
                   nomeNormalizado.includes(productName);
          });
        }

        if (match) {
          console.log(`✅ Encontrado por nome: ${match.name}`);
          matches[nome] = match;
          continue;
        }
      }

      console.log(`❌ Não encontrado: SKU="${sku}", Nome="${nome}", EAN="${ean}"`);
    }

    console.log(`🎯 Total de correspondências encontradas: ${Object.keys(matches).length}`);

    res.json({
      success: true,
      matches,
      totalItems: items.length,
      matchedItems: Object.keys(matches).length,
    });

  } catch (error: any) {
    console.error('❌ Erro ao buscar correspondências:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// CORREÇÃO MANUAL: Forçar status baseado na interface do Bling
router.post('/force-status-correction/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const { correctStatus } = req.body; // Status correto visto na interface do Bling
    const userId = req.user!.userId;

    console.log(`🔧 CORREÇÃO FORÇADA: Pedido #${orderNumber} para status "${correctStatus}"`);

    // Buscar o pedido no banco
    const order = await prisma.blingOrder.findFirst({
      where: {
        OR: [
          { orderNumber: String(orderNumber) },
          { blingOrderId: String(orderNumber) }
        ],
        accountId,
        userId,
      },
    });

    if (!order) {
      return res.json({ success: false, error: 'Pedido não encontrado no banco de dados' });
    }

    console.log(`📋 Status atual no DB: ${order.status}`);
    console.log(`🎯 Status correto informado: ${correctStatus}`);

    // Verificar se precisa de baixa automática
    const statusNormalized = correctStatus.toLowerCase().trim();
    const statusParaBaixa = [
      'verificado', 'checado', 'aprovado', 'pronto para envio',
      'verified', 'checked', 'approved', 'ready to ship'
    ];
    const needsProcessing = statusParaBaixa.includes(statusNormalized);

    console.log(`🚀 Precisa de baixa automática: ${needsProcessing ? 'SIM' : 'NÃO'}`);

    // Atualizar status no banco
    const updatedOrder = await prisma.blingOrder.update({
      where: { id: order.id },
      data: {
        status: correctStatus,
        isProcessed: needsProcessing ? false : order.isProcessed, // Reset se precisa processar
        updatedAt: new Date(),
      },
    });

    let autoProcessed = false;
    let produtosProcessados = 0;

    // Processar baixa automática se necessário
    if (needsProcessing && !order.isProcessed) {
      console.log(`🔥 PROCESSANDO BAIXA AUTOMÁTICA CORRIGIDA para pedido #${orderNumber}`);
      
      const items = JSON.parse(order.items);

      await prisma.$transaction(async (tx) => {
        for (const item of items) {
          const sku = item.codigo || item.produto?.codigo;
          const quantidade = item.quantidade || 1;
          
          if (!sku) {
            console.log(`⚠️ Item sem SKU:`, item);
            continue;
          }

          const product = await tx.product.findUnique({
            where: { sku },
          });

          if (product) {
            console.log(`📦 BAIXA CORRIGIDA: ${quantidade}x ${product.name} (SKU: ${sku})`);
            
            await tx.movement.create({
              data: {
                type: 'EXIT',
                productId: product.id,
                quantity: quantidade,
                reason: `Baixa automática CORRIGIDA - Pedido #${orderNumber} (${correctStatus})`,
                userId,
                syncStatus: 'synced',
              },
            });
            
            produtosProcessados++;
          } else {
            console.log(`⚠️ Produto não encontrado - SKU: ${sku}`);
          }
        }

        // Marcar como processado
        await tx.blingOrder.update({
          where: { id: order.id },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
      });

      autoProcessed = true;
      console.log(`✅ BAIXA CORRIGIDA CONCLUÍDA: ${produtosProcessados} produtos processados`);
    }

    res.json({ 
      success: true, 
      message: `Status corrigido para "${correctStatus}"${autoProcessed ? ` e baixa processada (${produtosProcessados} produtos)` : ''}`,
      details: {
        oldStatus: order.status,
        newStatus: correctStatus,
        needsProcessing,
        autoProcessed,
        produtosProcessados,
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na correção forçada:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// INVESTIGAÇÃO ESPECÍFICA: Comparar status Bling vs Sistema
router.get('/investigate-order/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const userId = req.user!.userId;

    console.log(`🔍 INVESTIGAÇÃO: Pedido #${orderNumber}`);

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    // 1. Buscar no banco de dados local
    const dbOrder = await prisma.blingOrder.findFirst({
      where: {
        OR: [
          { orderNumber: String(orderNumber) },
          { blingOrderId: String(orderNumber) }
        ],
        accountId,
        userId,
      },
    });

    // 2. Buscar na API do Bling
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const orders = response.data?.data || [];
    const blingOrder = orders.find((o: any) => String(o.numero) === orderNumber || String(o.id) === orderNumber);

    if (!blingOrder) {
      return res.json({ success: false, error: 'Pedido não encontrado na API do Bling' });
    }

    // 3. Analisar situação do Bling
    const situacao = blingOrder.situacao || {};
    
    console.log(`📋 SITUAÇÃO BRUTA DO BLING:`, JSON.stringify(situacao, null, 2));
    
    // 4. Aplicar nossa lógica de mapeamento
    const possibleStatusFields = [
      { field: 'situacao.nome', value: situacao.nome },
      { field: 'situacao.descricao', value: situacao.descricao },
      { field: 'situacao.valor', value: situacao.valor },
      { field: 'situacao.texto', value: situacao.texto },
      { field: 'situacao.status', value: situacao.status },
      { field: 'situacao.situacao', value: situacao.situacao },
      { field: 'order.status', value: blingOrder.status },
      { field: 'order.situacao_nome', value: blingOrder.situacao_nome },
      { field: 'order.situacao_descricao', value: blingOrder.situacao_descricao },
    ];
    
    let statusTexto = '';
    let foundField = '';
    
    for (const item of possibleStatusFields) {
      if (item.value && typeof item.value === 'string' && item.value.trim().length > 0) {
        statusTexto = item.value.trim();
        foundField = item.field;
        break;
      }
    }

    // 5. Mapear por ID se não encontrou texto
    const statusMap: Record<number, string> = {
      0: 'Em Aberto', 1: 'Atendido', 2: 'Cancelado', 3: 'Em Andamento', 4: 'Venda Agenciada',
      5: 'Verificado', 6: 'Aguardando', 7: 'Não Entregue', 8: 'Entregue', 9: 'Em Digitação',
      10: 'Checado', 11: 'Enviado', 12: 'Pronto para Envio', 13: 'Pendente', 14: 'Faturado',
      15: 'Pronto', 16: 'Impresso', 17: 'Separado', 18: 'Embalado', 19: 'Coletado',
      20: 'Em Trânsito', 21: 'Devolvido', 22: 'Extraviado', 23: 'Tentativa de Entrega',
      24: 'Verificado', // CORREÇÃO: Era "Reagendado", agora é "Verificado"
      25: 'Bloqueado', 26: 'Suspenso', 27: 'Processando',
      28: 'Aprovado', 29: 'Reprovado', 30: 'Estornado',
    };

    let finalStatus: string;
    if (statusTexto && statusTexto.length > 0) {
      finalStatus = statusTexto;
    } else if (situacao.id !== undefined && statusMap[situacao.id]) {
      finalStatus = statusMap[situacao.id];
    } else if (situacao.id !== undefined) {
      finalStatus = `Status ${situacao.id}`;
    } else {
      finalStatus = 'Aguardando Processamento';
    }

    console.log(`🎯 RESULTADO DA INVESTIGAÇÃO:`);
    console.log(`   - Status no DB: ${dbOrder?.status || 'NÃO ENCONTRADO'}`);
    console.log(`   - Status calculado do Bling: ${finalStatus}`);
    console.log(`   - Campo usado: ${foundField || 'ID: ' + situacao.id}`);
    console.log(`   - Valor bruto: ${statusTexto || situacao.id}`);

    res.json({
      success: true,
      investigation: {
        orderNumber,
        database: {
          found: !!dbOrder,
          status: dbOrder?.status,
          isProcessed: dbOrder?.isProcessed,
          createdAt: dbOrder?.createdAt,
          updatedAt: dbOrder?.updatedAt,
        },
        bling: {
          situacaoId: situacao.id,
          situacaoCompleta: situacao,
          possibleFields: possibleStatusFields,
          statusTextoEncontrado: statusTexto,
          foundField,
          finalStatusCalculado: finalStatus,
        },
        comparison: {
          statusMatch: dbOrder?.status === finalStatus,
          needsUpdate: dbOrder?.status !== finalStatus,
          shouldProcessStock: ['verificado', 'checado', 'aprovado', 'pronto para envio'].includes(finalStatus.toLowerCase()),
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Erro na investigação:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// DEBUG AVANÇADO: Rota para testar status de um pedido específico
router.get('/debug-status/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    // Buscar pedido específico na API do Bling
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const orders = response.data?.data || [];
    const targetOrder = orders.find((o: any) => String(o.numero) === orderNumber || String(o.id) === orderNumber);

    if (!targetOrder) {
      return res.json({ success: false, error: 'Pedido não encontrado na API do Bling' });
    }

    // ANÁLISE COMPLETA DO STATUS
    const situacao = targetOrder.situacao || {};
    
    // Aplicar a mesma lógica de mapeamento do código principal
    const possibleStatusFields = [
      situacao.nome,
      situacao.descricao,
      situacao.valor,
      situacao.texto,
      situacao.status,
      situacao.situacao,
      targetOrder.status,
      targetOrder.situacao_nome,
      targetOrder.situacao_descricao,
      situacao.situacao?.nome,
      situacao.situacao?.descricao,
      situacao.situacao?.valor,
    ];
    
    let statusTexto = '';
    let foundField = '';
    
    for (let i = 0; i < possibleStatusFields.length; i++) {
      const field = possibleStatusFields[i];
      if (field && typeof field === 'string' && field.trim().length > 0) {
        statusTexto = field.trim();
        foundField = `campo ${i + 1}`;
        break;
      }
    }

    // Mapear status final
    const statusMap: Record<number, string> = {
      0: 'Em Aberto', 1: 'Atendido', 2: 'Cancelado', 3: 'Em Andamento', 4: 'Venda Agenciada',
      5: 'Verificado', 6: 'Aguardando', 7: 'Não Entregue', 8: 'Entregue', 9: 'Em Digitação',
      10: 'Checado', 11: 'Enviado', 12: 'Pronto para Envio', 13: 'Pendente', 14: 'Faturado',
      15: 'Pronto', 16: 'Impresso', 17: 'Separado', 18: 'Embalado', 19: 'Coletado',
      20: 'Em Trânsito', 21: 'Devolvido', 22: 'Extraviado', 23: 'Tentativa de Entrega',
      24: 'Verificado', // CORREÇÃO: Era "Reagendado", agora é "Verificado"
      25: 'Bloqueado', 26: 'Suspenso', 27: 'Processando',
      28: 'Aprovado', 29: 'Reprovado', 30: 'Estornado',
    };

    let finalStatus: string;
    if (statusTexto && statusTexto.length > 0) {
      finalStatus = statusTexto;
    } else if (situacao.id !== undefined && statusMap[situacao.id]) {
      finalStatus = statusMap[situacao.id];
    } else if (situacao.id !== undefined) {
      finalStatus = `Status ${situacao.id}`;
    } else {
      finalStatus = 'Aguardando Processamento';
    }

    // Verificar se precisa de baixa automática
    const statusNormalized = finalStatus.toLowerCase().trim();
    const statusParaBaixa = [
      'verificado', 'checado', 'aprovado', 'pronto para envio',
      'verified', 'checked', 'approved', 'ready to ship'
    ];
    const needsProcessing = statusParaBaixa.includes(statusNormalized);

    res.json({
      success: true,
      debug: {
        orderNumber,
        situacaoId: situacao.id,
        statusTextoEncontrado: statusTexto,
        foundField,
        finalStatus,
        needsProcessing,
        statusNormalized,
        // Comparação com banco de dados
        dbOrder: await prisma.blingOrder.findFirst({
          where: {
            OR: [
              { orderNumber: String(orderNumber) },
              { blingOrderId: String(targetOrder.id) }
            ],
            accountId,
            userId,
          },
        }),
      }
    });

  } catch (error: any) {
    console.error('❌ Erro no debug avançado:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// DEBUG: Rota temporária para investigar status do Bling
router.get('/debug-order/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    // Buscar pedido específico
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const orders = response.data?.data || [];
    const targetOrder = orders.find((o: any) => String(o.numero) === orderNumber || String(o.id) === orderNumber);

    if (!targetOrder) {
      return res.json({ success: false, error: 'Pedido não encontrado' });
    }

    // Retornar dados brutos para debug
    res.json({
      success: true,
      debug: {
        orderNumber,
        rawOrder: targetOrder,
        situacao: targetOrder.situacao,
        statusId: targetOrder.situacao?.id,
        statusTexto: targetOrder.situacao?.valor || targetOrder.situacao?.nome || targetOrder.situacao?.descricao,
        allFields: Object.keys(targetOrder.situacao || {}),
      }
    });

  } catch (error: any) {
    console.error('❌ Erro no debug:', error.message);
    res.json({ success: false, error: error.message });
  }
});

// Re-sincronizar pedido específico para buscar items completos
router.post('/resync-order/:accountId/:orderNumber', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId, orderNumber } = req.params;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    const BLING_API_URL = 'https://www.bling.com.br/Api/v3';

    // Buscar pedido na lista
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    const orders = response.data?.data || [];
    const targetOrder = orders.find((o: any) => String(o.numero) === orderNumber || String(o.id) === orderNumber);

    if (!targetOrder) {
      return res.json({ success: false, error: 'Pedido não encontrado' });
    }

    // Buscar detalhes completos
    const orderDetails = await fetchOrderDetails(targetOrder.id, accessToken);
    const orderToUse = orderDetails || targetOrder;

    console.log(`🔄 RE-SYNC Pedido #${orderToUse.numero} - Items: ${(orderToUse.itens || []).length}`);

    // Atualizar no banco
    await prisma.blingOrder.update({
      where: {
        blingOrderId_accountId: {
          blingOrderId: String(orderToUse.id),
          accountId: accountId,
        },
      },
      data: {
        items: JSON.stringify(orderToUse.itens || []),
        updatedAt: new Date(),
      },
    });

    return res.json({ 
      success: true, 
      message: `Pedido #${orderNumber} re-sincronizado com ${(orderToUse.itens || []).length} items`,
      itemsCount: (orderToUse.itens || []).length
    });
  } catch (error: any) {
    console.error('Erro ao re-sincronizar pedido:', error);
    return res.json({ success: false, error: error.message });
  }
});

// Função para refresh do token
async function refreshAccessToken(account: any): Promise<string> {
  const credentials = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');

  const response = await axios.post(
    BLING_TOKEN_URL,
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

// Buscar pedidos de venda do Bling
router.get('/orders/:accountId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    console.log('Buscando pedidos para conta:', accountId, 'usuário:', userId);

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      console.log('Conta não conectada ou sem token');
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    console.log('Conta encontrada:', account.name);

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      console.log('🔄 Token expirado, renovando...');
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        console.error('❌ Erro ao renovar token:', refreshError.response?.data || refreshError.message);
        return res.json({ success: false, error: 'Token expirado. Reconecte a conta Bling.' });
      }
    }

    // Buscar pedidos de venda do Bling
    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;
    let lastError: string | null = null;

    console.log('📦 Iniciando busca de pedidos na API Bling...');

    while (hasMore && page <= 10) {
      try {
        // Aumentar delay para evitar rate limit (3 req/segundo = 333ms)
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms entre páginas
        }
        
        console.log(`Fazendo requisição para página ${page}...`);
        const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=${page}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          timeout: 20000, // Aumentar timeout para 20 segundos
        });

        console.log(`Página ${page} - Status:`, response.status);
        console.log(`Página ${page} - Headers:`, response.headers['content-type']);
        
        const orders = response.data?.data || [];
        console.log(`Página ${page} - Pedidos encontrados:`, orders.length);
        
        // Log da estrutura do primeiro pedido para debug
        if (orders.length > 0 && page === 1) {
          console.log('Estrutura do primeiro pedido:', JSON.stringify(orders[0], null, 2));
        }
        
        allOrders = allOrders.concat(orders);

        if (orders.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (apiError: any) {
        console.error('Erro na API Bling:');
        console.error('- Status:', apiError.response?.status);
        console.error('- Status Text:', apiError.response?.statusText);
        console.error('- Data:', JSON.stringify(apiError.response?.data, null, 2));
        console.error('- Headers:', apiError.response?.headers);
        console.error('- Config URL:', apiError.config?.url);
        console.error('- Message:', apiError.message);
        
        // Capturar mensagem de erro mais específica
        let errorMessage = 'Erro na busca pedidos';
        
        if (apiError.response?.data?.error?.message) {
          errorMessage = apiError.response.data.error.message;
        } else if (apiError.response?.data?.error?.description) {
          errorMessage = apiError.response.data.error.description;
        } else if (apiError.response?.data?.message) {
          errorMessage = apiError.response.data.message;
        } else if (apiError.response?.statusText) {
          errorMessage = `${apiError.response.status} - ${apiError.response.statusText}`;
        } else if (apiError.message) {
          errorMessage = apiError.message;
        }
        
        lastError = errorMessage;
        
        // Se for 429 (rate limit), aguarda mais tempo
        if (apiError.response?.status === 429) {
          console.log('⏳ Rate limit atingido, aguardando 3 segundos...');
          await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos
          continue;
        }
        
        // Se for 401, tenta renovar o token
        if (apiError.response?.status === 401) {
          console.log('Token inválido (401), tentando renovar...');
          try {
            accessToken = await refreshAccessToken(account);
            console.log('Token renovado com sucesso, tentando novamente...');
            continue; // Tenta novamente com o novo token
          } catch (refreshError: any) {
            console.error('Falha ao renovar token:', refreshError.message);
            return res.json({ success: false, error: 'Token inválido. Reconecte a conta Bling.' });
          }
        }
        
        // Se for erro de timeout ou conexão
        if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
          console.log('Timeout na requisição, tentando novamente...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        hasMore = false;
      }
    }

    console.log('📦 Total de pedidos encontrados:', allOrders.length);

    // Se não encontrou pedidos e teve erro, retorna o erro
    if (allOrders.length === 0 && lastError) {
      console.log('❌ Nenhum pedido encontrado e houve erro:', lastError);
      return res.json({ success: false, error: lastError });
    }

    // Se não encontrou pedidos mas não teve erro, pode ser que não existam pedidos
    if (allOrders.length === 0) {
      console.log('ℹ️ Nenhum pedido encontrado na conta Bling');
      return res.json({ success: true, orders: [], message: 'Nenhum pedido encontrado na conta Bling' });
    }

    // Mapear status do Bling - baseado na API v3
    // Mapeamento completo dos status do Bling para evitar "Sem Status"
    // CORREÇÃO CRÍTICA: ID 24 deve ser "Verificado" não "Reagendado"
    const statusMap: Record<number, string> = {
      0: 'Em Aberto',
      1: 'Atendido',
      2: 'Cancelado',
      3: 'Em Andamento',
      4: 'Venda Agenciada',
      5: 'Verificado',
      6: 'Aguardando',
      7: 'Não Entregue',
      8: 'Entregue',
      9: 'Em Digitação',
      10: 'Checado',
      11: 'Enviado',
      12: 'Pronto para Envio',
      13: 'Pendente',
      14: 'Faturado',
      15: 'Pronto',
      16: 'Impresso',
      17: 'Separado',
      18: 'Embalado',
      19: 'Coletado',
      20: 'Em Trânsito',
      21: 'Devolvido',
      22: 'Extraviado',
      23: 'Tentativa de Entrega',
      24: 'Verificado', // CORREÇÃO: Era "Reagendado", agora é "Verificado"
      25: 'Bloqueado',
      26: 'Suspenso',
      27: 'Processando',
      28: 'Aprovado',
      29: 'Reprovado',
      30: 'Estornado',
    };

    // Salvar/atualizar pedidos no banco e processar automaticamente se necessário
    console.log(`💾 Processando ${allOrders.length} pedidos em lote...`);
    
    // Preparar dados para operação em lote
    const ordersToProcess: any[] = [];
    const statusParaBaixa = ['Verificado']; // APENAS status "Verificado" dá baixa automática
    
    for (const order of allOrders) {
      try {
        // Buscar detalhes completos do pedido para garantir que temos todos os itens
        const orderDetails = await fetchOrderDetails(order.id, accessToken);
        const orderToUse = orderDetails || order;
        
        console.log(`📦 Pedido #${orderToUse.numero} - Itens: ${(orderToUse.itens || []).length}`);
        
        // SOLUÇÃO DEFINITIVA: Capturar status da API Bling v3 de forma mais robusta
        const situacao = orderToUse.situacao || {};
        const statusId = situacao.id;
        
        // LOG COMPLETO da estrutura para debug
        console.log(`📋 ANÁLISE COMPLETA Pedido #${orderToUse.numero}:`);
        console.log(`   - situacao completa:`, JSON.stringify(situacao, null, 2));
        console.log(`   - order keys:`, Object.keys(orderToUse));
        
        // 🔍 CAPTURAR STATUS PARA MAPEAMENTO
        if (situacao.id !== undefined) {
          console.log(`🎯 STATUS CAPTURADO: ID=${situacao.id}, Nome="${situacao.nome || situacao.valor || 'N/A'}"`);
        }
        
        // NOVA ESTRATÉGIA: Testar TODOS os campos possíveis da situacao
        const possibleStatusFields = [
          // Campos mais comuns da API Bling v3
          situacao.nome,           // Campo principal na v3
          situacao.descricao,      // Campo alternativo
          situacao.valor,          // Campo de valor
          situacao.texto,          // Campo de texto
          situacao.status,         // Campo status direto
          situacao.situacao,       // Campo situacao aninhado
          // Campos do pedido principal
          orderToUse.status,
          orderToUse.situacao_nome,
          orderToUse.situacao_descricao,
          // Campos aninhados se existirem
          situacao.situacao?.nome,
          situacao.situacao?.descricao,
          situacao.situacao?.valor,
        ];
        
        let statusTexto = '';
        let foundField = '';
        
        for (let i = 0; i < possibleStatusFields.length; i++) {
          const field = possibleStatusFields[i];
          if (field && typeof field === 'string' && field.trim().length > 0) {
            statusTexto = field.trim();
            foundField = `campo ${i + 1}`;
            break;
          }
        }
        
        console.log(`   - statusId: ${statusId}`);
        console.log(`   - statusTexto encontrado: "${statusTexto}" (${foundField})`);
        
        // ESTRATÉGIA DE MAPEAMENTO MELHORADA
        let status: string;
        
        // 1. PRIORIDADE: Usar texto encontrado (mais confiável que ID)
        if (statusTexto && statusTexto.length > 0) {
          status = statusTexto;
          console.log(`✅ Status capturado pelo TEXTO: "${status}"`);
        }
        // 2. FALLBACK: Usar mapeamento por ID se disponível
        else if (statusId !== undefined && statusMap[statusId]) {
          status = statusMap[statusId];
          console.log(`✅ Status mapeado pelo ID ${statusId}: "${status}"`);
        }
        // 3. FALLBACK: ID não mapeado
        else if (statusId !== undefined) {
          status = `Status ${statusId}`;
          console.log(`⚠️ Status não mapeado, usando ID: "${status}"`);
        }
        // 4. ÚLTIMO RECURSO
        else {
          status = 'Aguardando Processamento';
          console.log(`❌ Nenhum status encontrado, usando padrão: "${status}"`);
        }
        
        console.log(`🎯 STATUS FINAL DEFINIDO: "${status}"`);
        
        // VERIFICAÇÃO MELHORADA para baixa automática
        // Aceitar variações de "Verificado" e "Checado"
        const statusNormalized = status.toLowerCase().trim();
        const statusParaBaixa = [
          'verificado', 'checado', 'aprovado', 'pronto para envio',
          'verified', 'checked', 'approved', 'ready to ship'
        ];
        const needsProcessing = statusParaBaixa.includes(statusNormalized);
        
        if (needsProcessing) {
          console.log(`🚀 PEDIDO MARCADO PARA BAIXA AUTOMÁTICA: #${orderToUse.numero} - Status: "${status}"`);
        }
        
        // Processar data corretamente para evitar problemas de timezone
        let blingCreatedAt: Date | null = null;
        if (orderToUse.data) {
          // Se a data vem no formato YYYY-MM-DD, adiciona horário para evitar timezone offset
          if (typeof orderToUse.data === 'string' && orderToUse.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
            blingCreatedAt = new Date(orderToUse.data + 'T12:00:00.000Z');
          } else {
            blingCreatedAt = new Date(orderToUse.data);
          }
        }
        
        ordersToProcess.push({
          blingOrderId: String(orderToUse.id),
          orderNumber: String(orderToUse.numero || orderToUse.id),
          status,
          customerName: orderToUse.contato?.nome || null,
          totalAmount: orderToUse.total || 0,
          items: JSON.stringify(orderToUse.itens || []),
          blingCreatedAt,
          needsProcessing
        });
      } catch (orderError: any) {
        console.error(`❌ Erro ao preparar pedido ${order.numero}:`, orderError.message);
      }
    }

    // Processar pedidos em lote usando transação com timeout maior
    let processedCount = 0;
    let autoProcessedCount = 0;
    
    // Processar em lotes menores para evitar timeout
    const batchSize = 10;
    for (let i = 0; i < ordersToProcess.length; i += batchSize) {
      const batch = ordersToProcess.slice(i, i + batchSize);
      
      await prisma.$transaction(async (tx) => {
        for (const orderData of batch) {
          try {
            // Verificar se o pedido já existe e forçar atualização se necessário
            const existingOrder = await tx.blingOrder.findUnique({
              where: {
                blingOrderId_accountId: {
                  blingOrderId: orderData.blingOrderId,
                  accountId: accountId,
                },
              },
            });

            // FORÇAR ATUALIZAÇÃO: Se o pedido existe e o status é diferente, sempre atualizar
            const forceUpdate = existingOrder && existingOrder.status !== orderData.status;
            if (forceUpdate) {
              console.log(`🔄 FORÇANDO ATUALIZAÇÃO: Pedido #${orderData.orderNumber} de "${existingOrder.status}" para "${orderData.status}"`);
            }

            const savedOrder = await tx.blingOrder.upsert({
              where: {
                blingOrderId_accountId: {
                  blingOrderId: orderData.blingOrderId,
                  accountId: accountId,
                },
              },
              update: {
                status: orderData.status, // SEMPRE atualizar o status
                customerName: orderData.customerName,
                totalAmount: orderData.totalAmount,
                items: orderData.items,
                updatedAt: new Date(),
                // Se mudou para "Verificado", resetar processamento
                isProcessed: (orderData.status === 'Verificado' && existingOrder?.status !== 'Verificado') ? false : existingOrder?.isProcessed,
              },
              create: {
                blingOrderId: orderData.blingOrderId,
                orderNumber: orderData.orderNumber,
                accountId,
                userId,
                status: orderData.status,
                customerName: orderData.customerName,
                totalAmount: orderData.totalAmount,
                items: orderData.items,
                blingCreatedAt: orderData.blingCreatedAt,
                isProcessed: false,
              },
            });

            processedCount++;

            // 🚀 BAIXA AUTOMÁTICA NO ESTOQUE com correspondência melhorada
            if (orderData.needsProcessing && !savedOrder.isProcessed) {
              console.log(`🔥 BAIXA AUTOMÁTICA ATIVADA para pedido #${orderData.orderNumber} - Status: "${orderData.status}"`);
              
              const items = JSON.parse(orderData.items);
              let produtosProcessados = 0;

              for (const item of items) {
                const sku = item.codigo || item.produto?.codigo;
                const nome = item.nome || item.produto?.nome;
                const ean = item.ean || item.produto?.ean;
                const quantidade = item.quantidade || 1;
                
                console.log(`📦 Processando item: SKU="${sku}", Nome="${nome}", EAN="${ean}", Qtd=${quantidade}`);

                let product: any = null;

                // 1. Buscar por SKU exato
                if (sku) {
                  product = await tx.product.findFirst({
                    where: {
                      OR: [
                        { sku: sku },
                        { internalCode: sku }
                      ]
                    }
                  });
                  if (product) {
                    console.log(`✅ Produto encontrado por SKU: ${product.name}`);
                  }
                }

                // 2. Buscar por EAN se não encontrou por SKU
                if (!product && ean) {
                  product = await tx.product.findFirst({
                    where: { ean: ean }
                  });
                  if (product) {
                    console.log(`✅ Produto encontrado por EAN: ${product.name}`);
                  }
                }

                // 3. Buscar por nome se não encontrou por SKU/EAN
                if (!product && nome) {
                  const nomeNormalizado = nome.toLowerCase().trim();
                  
                  // Busca exata por nome
                  product = await tx.product.findFirst({
                    where: {
                      name: {
                        equals: nome,
                        mode: 'insensitive'
                      }
                    }
                  });

                  // Se não encontrou, busca por similaridade
                  if (!product) {
                    const allProducts = await tx.product.findMany({
                      select: { id: true, name: true, sku: true }
                    });
                    
                    product = allProducts.find(p => {
                      const productName = p.name.toLowerCase().trim();
                      return productName.includes(nomeNormalizado) || 
                             nomeNormalizado.includes(productName);
                    });
                  }

                  if (product) {
                    console.log(`✅ Produto encontrado por nome: ${product.name}`);
                  }
                }

                if (product) {
                  console.log(`📦 DANDO BAIXA AUTOMÁTICA: ${quantidade}x ${product.name} (SKU: ${product.sku})`);
                  
                  // Criar movimento de saída
                  await tx.movement.create({
                    data: {
                      type: 'EXIT',
                      productId: product.id,
                      quantity: quantidade,
                      reason: `Baixa automática - Pedido Bling #${orderData.orderNumber} (${orderData.status})`,
                      userId,
                      syncStatus: 'synced',
                    },
                  });
                  
                  produtosProcessados++;
                } else {
                  console.log(`⚠️ Produto não encontrado no estoque - SKU: "${sku}", Nome: "${nome}", EAN: "${ean}"`);
                }
              }

              // Marcar pedido como processado
              await tx.blingOrder.update({
                where: { id: savedOrder.id },
                data: {
                  isProcessed: true,
                  processedAt: new Date(),
                },
              });

              autoProcessedCount++;
              console.log(`✅ BAIXA AUTOMÁTICA CONCLUÍDA: ${produtosProcessados} produtos processados para pedido #${orderData.orderNumber}`);
            } else if (orderData.needsProcessing && savedOrder.isProcessed) {
              console.log(`ℹ️ Pedido #${orderData.orderNumber} já foi processado anteriormente`);
            } else {
              console.log(`ℹ️ Pedido #${orderData.orderNumber} com status "${orderData.status}" - não requer baixa automática`);
            }
          } catch (upsertError: any) {
            console.error(`❌ Erro ao salvar pedido ${orderData.orderNumber}:`, upsertError.message);
          }
        }
      }, {
        timeout: 15000, // 15 segundos de timeout por lote
      });
      
      console.log(`📦 Lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(ordersToProcess.length/batchSize)} processado`);
    }

    console.log(`🎉 Processamento concluído: ${processedCount} pedidos, ${autoProcessedCount} com baixa automática`);

    // Retornar pedidos do banco
    const savedOrders = await prisma.blingOrder.findMany({
      where: { accountId, userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    console.log(`📊 Pedidos salvos no banco: ${savedOrders.length}`);
    console.log(`📊 Retornando ${savedOrders.length} pedidos para o frontend`);

    // 🔄 ATUALIZAÇÃO AUTOMÁTICA: Buscar items para pedidos que estão vazios
    // Só atualiza pedidos que realmente precisam (items vazios)
    const ordersNeedingUpdate = savedOrders.filter(o => {
      try {
        const items = JSON.parse(o.items);
        return items.length === 0;
      } catch {
        return false;
      }
    });
    
    if (ordersNeedingUpdate.length > 0) {
      console.log(`🔍 Encontrados ${ordersNeedingUpdate.length} pedidos sem items, buscando detalhes...`);
      let updatedCount = 0;
      
      for (const order of ordersNeedingUpdate) {
        try {
          console.log(`📦 Buscando items para pedido #${order.orderNumber}...`);
          
          // Buscar detalhes completos do Bling
          const orderDetails = await fetchOrderDetails(order.blingOrderId, accessToken);
          
          if (orderDetails && orderDetails.itens && orderDetails.itens.length > 0) {
            console.log(`✅ Encontrados ${orderDetails.itens.length} items para pedido #${order.orderNumber}`);
            
            // Atualizar no banco
            await prisma.blingOrder.update({
              where: { id: order.id },
              data: {
                items: JSON.stringify(orderDetails.itens),
                updatedAt: new Date(),
              },
            });
            
            // Atualizar no array de retorno
            order.items = JSON.stringify(orderDetails.itens);
            updatedCount++;
          } else {
            console.log(`⚠️ Nenhum item encontrado para pedido #${order.orderNumber}`);
          }
          
          // Delay para respeitar rate limit (3 req/segundo = 333ms)
          await new Promise(resolve => setTimeout(resolve, 400));
        } catch (itemError: any) {
          console.error(`❌ Erro ao atualizar items do pedido #${order.orderNumber}:`, itemError.message);
        }
      }
      
      if (updatedCount > 0) {
        console.log(`✅ ${updatedCount} de ${ordersNeedingUpdate.length} pedidos atualizados com items completos`);
      }
    } else {
      console.log(`✅ Todos os pedidos já possuem items`);
    }

    res.json({
      success: true,
      orders: savedOrders.map(o => ({
        ...o,
        items: JSON.parse(o.items),
      })),
    });
  } catch (error: any) {
    console.error('❌ Erro ao buscar pedidos:', error.response?.data || error.message);
    console.error('❌ Stack trace:', error.stack);
    
    // Retornar erro mais específico
    let errorMessage = 'Erro ao buscar pedidos';
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    res.json({ success: false, error: errorMessage });
  }
});

// Buscar pedidos verificados (prontos para dar baixa)
router.get('/orders/verified/:accountId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    const orders = await prisma.blingOrder.findMany({
      where: {
        accountId,
        userId,
        OR: [
          { status: 'Verificado' },
          { status: 'Checado' },
        ],
        isProcessed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      orders: orders.map(o => ({
        ...o,
        items: JSON.parse(o.items),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar pedidos verificados:', error);
    res.json({ success: false, error: 'Erro ao buscar pedidos verificados' });
  }
});

// Buscar todos os pedidos dos últimos 3 meses (para tela de Vendas)
router.get('/orders/all/:accountId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user!.userId;

    // Últimos 3 meses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const orders = await prisma.blingOrder.findMany({
      where: {
        accountId,
        userId,
        createdAt: { gte: threeMonthsAgo },
      },
      orderBy: { blingCreatedAt: 'desc' }, // Ordenar pela data do Bling (mais recente primeiro)
    });

    res.json({
      success: true,
      orders: orders.map(o => ({
        ...o,
        items: JSON.parse(o.items),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar todos os pedidos:', error);
    res.json({ success: false, error: 'Erro ao buscar pedidos' });
  }
});

// Processar pedido (dar baixa no estoque)
router.post('/orders/:orderId/process', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.blingOrder.findFirst({
      where: { id: orderId, userId },
    });

    if (!order) {
      return res.json({ success: false, error: 'Pedido não encontrado' });
    }

    if (order.isProcessed) {
      return res.json({ success: false, error: 'Pedido já foi processado' });
    }

    const items = JSON.parse(order.items);

    // Dar baixa no estoque para cada item
    for (const item of items) {
      const sku = item.codigo || item.produto?.codigo;
      if (!sku) continue;

      const product = await prisma.product.findUnique({
        where: { sku },
      });

      if (product) {
        // Criar movimento de saída
        await prisma.movement.create({
          data: {
            type: 'EXIT',
            productId: product.id,
            quantity: item.quantidade || 1,
            reason: `Pedido Bling #${order.orderNumber}`,
            userId,
            syncStatus: 'synced',
          },
        });
      }
    }

    // Marcar pedido como processado
    await prisma.blingOrder.update({
      where: { id: orderId },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Baixa no estoque realizada com sucesso!' });
  } catch (error: any) {
    console.error('Erro ao processar pedido:', error);
    res.json({ success: false, error: 'Erro ao processar pedido' });
  }
});

export default router;
