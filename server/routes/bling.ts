import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

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
        // Reduzir delay para 200ms (5 req/segundo) - mais rápido mas ainda seguro
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log(`Fazendo requisição para página ${page}...`);
        const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=${page}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          timeout: 15000, // Aumentar timeout para 15 segundos
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
        
        // Se for 429 (rate limit), aguarda menos tempo
        if (apiError.response?.status === 429) {
          console.log('⏳ Rate limit atingido, aguardando 1 segundo...');
          await new Promise(resolve => setTimeout(resolve, 1000));
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
      24: 'Reagendado',
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
        // O status pode vir de diferentes formas na API v3
        const statusId = order.situacao?.id;
        const statusTexto = order.situacao?.valor || order.situacao?.nome || order.situacao?.descricao || '';
        
        // LOG DETALHADO para debug
        console.log(`📋 Pedido #${order.numero}: statusId=${statusId}, statusTexto="${statusTexto}"`);
        console.log(`📋 Situação completa:`, JSON.stringify(order.situacao, null, 2));
        
        // Lógica melhorada para mapear status - NUNCA retorna "Sem Status"
        let status: string;
        
        // 1. Primeiro tenta pelo ID (mais confiável)
        if (statusId !== undefined && statusMap[statusId]) {
          status = statusMap[statusId];
        }
        // 2. Se não tem ID ou não está mapeado, usa o texto da API
        else if (statusTexto && typeof statusTexto === 'string' && statusTexto.trim().length > 0) {
          status = statusTexto.trim();
        }
        // 3. Se tem ID mas não está no mapeamento, cria um status descritivo
        else if (statusId !== undefined) {
          status = `Status ${statusId}`;
        }
        // 4. Último recurso - status padrão mais descritivo
        else {
          status = 'Aguardando Processamento';
        }
        
        // Processar data corretamente para evitar problemas de timezone
        let blingCreatedAt: Date | null = null;
        if (order.data) {
          // Se a data vem no formato YYYY-MM-DD, adiciona horário para evitar timezone offset
          if (typeof order.data === 'string' && order.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
            blingCreatedAt = new Date(order.data + 'T12:00:00.000Z');
          } else {
            blingCreatedAt = new Date(order.data);
          }
        }
        
        ordersToProcess.push({
          blingOrderId: String(order.id),
          orderNumber: String(order.numero || order.id),
          status,
          customerName: order.contato?.nome || null,
          totalAmount: order.total || 0,
          items: JSON.stringify(order.itens || []),
          blingCreatedAt,
          needsProcessing: statusParaBaixa.includes(status)
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
            // Verificar se o pedido já existe
            const existingOrder = await tx.blingOrder.findUnique({
              where: {
                blingOrderId_accountId: {
                  blingOrderId: orderData.blingOrderId,
                  accountId: accountId,
                },
              },
            });

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
                // Se o status mudou para "Verificado" e ainda não foi processado, resetar isProcessed
                isProcessed: orderData.status === 'Verificado' ? false : undefined,
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

            // 🚀 BAIXA AUTOMÁTICA NO ESTOQUE (APENAS para status "Verificado" e pedidos não processados)
            if (orderData.needsProcessing && !savedOrder.isProcessed) {
              console.log(`🔥 Processando baixa automática para pedido #${orderData.orderNumber} - Status: ${orderData.status}`);
              
              const items = JSON.parse(orderData.items);
              let produtosProcessados = 0;

              for (const item of items) {
                const sku = item.codigo || item.produto?.codigo;
                const quantidade = item.quantidade || 1;
                
                if (!sku) {
                  console.log(`⚠️ Item sem SKU no pedido #${orderData.orderNumber}:`, item);
                  continue;
                }

                // Buscar produto pelo SKU
                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (product) {
                  console.log(`📦 Dando baixa: ${quantidade}x ${product.name} (SKU: ${sku})`);
                  
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
                  console.log(`⚠️ Produto não encontrado no estoque - SKU: ${sku}`);
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
              console.log(`✅ Baixa automática concluída: ${produtosProcessados} produtos processados para pedido #${orderData.orderNumber}`);
            } else if (orderData.needsProcessing && savedOrder.isProcessed) {
              console.log(`ℹ️ Pedido #${orderData.orderNumber} já foi processado anteriormente`);
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
