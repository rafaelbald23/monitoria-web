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
            <h1 style="color:red;">❌ Erro</h1>
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
            <h1 style="color:red;">❌ Erro</h1>
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
            <h1 style="color:red;">❌ Erro</h1>
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
            <h1 style="color:#22c55e;">✅ Conectado!</h1>
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
          <h1 style="color:red;">❌ Erro</h1>
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

    console.log('🔍 Buscando pedidos para conta:', accountId, 'usuário:', userId);

    const account = await prisma.blingAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account || !account.accessToken) {
      console.log('❌ Conta não conectada ou sem token');
      return res.json({ success: false, error: 'Conta não conectada' });
    }

    console.log('✅ Conta encontrada:', account.name);

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
        // Aguardar 400ms entre requisições para respeitar limite de 3/segundo
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=${page}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        });

        console.log(`📄 Página ${page} - Status:`, response.status);
        const orders = response.data?.data || [];
        console.log(`📄 Página ${page} - Pedidos encontrados:`, orders.length);
        
        allOrders = allOrders.concat(orders);

        if (orders.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (apiError: any) {
        console.error('❌ Erro na API Bling:', apiError.response?.status, apiError.response?.data);
        lastError = apiError.response?.data?.error?.message || apiError.response?.data?.error?.description || `Erro ${apiError.response?.status}`;
        
        // Se for 429 (rate limit), aguarda e tenta novamente
        if (apiError.response?.status === 429) {
          console.log('⏳ Rate limit atingido, aguardando 2 segundos...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        // Se for 401, tenta renovar o token
        if (apiError.response?.status === 401) {
          try {
            console.log('🔄 Token inválido, tentando renovar...');
            accessToken = await refreshAccessToken(account);
            continue; // Tenta novamente com o novo token
          } catch (refreshError: any) {
            console.error('❌ Falha ao renovar token:', refreshError.message);
            return res.json({ success: false, error: 'Token inválido. Reconecte a conta Bling.' });
          }
        }
        
        hasMore = false;
      }
    }

    console.log('📦 Total de pedidos encontrados:', allOrders.length);

    // Se não encontrou pedidos e teve erro, retorna o erro
    if (allOrders.length === 0 && lastError) {
      return res.json({ success: false, error: lastError });
    }

    // Mapear status do Bling - baseado na API v3
    // Se o ID não estiver mapeado, usa o valor texto que vem da API
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
    };

    // Salvar/atualizar pedidos no banco
    for (const order of allOrders) {
      try {
        // O status pode vir como objeto situacao.id ou situacao.valor
        const statusId = order.situacao?.id;
        const statusValor = order.situacao?.valor || order.situacao?.nome || '';
        // Usa o mapeamento se existir, senão usa o valor texto da API
        const status = statusMap[statusId] || statusValor || `Status ${statusId}`;
        
        console.log(`📦 Pedido #${order.numero}: situacao.id=${statusId}, situacao.valor=${statusValor}, status final=${status}`);
        
        await prisma.blingOrder.upsert({
          where: {
            blingOrderId_accountId: {
              blingOrderId: String(order.id),
              accountId: accountId,
            },
          },
          update: {
            status,
            customerName: order.contato?.nome || null,
            totalAmount: order.total || 0,
            items: JSON.stringify(order.itens || []),
            updatedAt: new Date(),
          },
          create: {
            blingOrderId: String(order.id),
            orderNumber: String(order.numero || order.id),
            accountId,
            userId,
            status,
            customerName: order.contato?.nome || null,
            totalAmount: order.total || 0,
            items: JSON.stringify(order.itens || []),
            blingCreatedAt: order.data ? new Date(order.data) : null,
          },
        });
      } catch (upsertError: any) {
        console.error(`❌ Erro ao salvar pedido ${order.numero}:`, upsertError.message);
      }
    }

    // Retornar pedidos do banco
    const savedOrders = await prisma.blingOrder.findMany({
      where: { accountId, userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({
      success: true,
      orders: savedOrders.map(o => ({
        ...o,
        items: JSON.parse(o.items),
      })),
    });
  } catch (error: any) {
    console.error('Erro ao buscar pedidos:', error.response?.data || error.message);
    res.json({ success: false, error: error.response?.data?.error?.message || 'Erro ao buscar pedidos' });
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
