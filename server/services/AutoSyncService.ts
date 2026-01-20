import prisma from '../lib/prisma.js';
import axios from 'axios';

const BLING_API_URL = 'https://www.bling.com.br/Api/v3';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

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

// Sincronizar pedidos de uma conta específica
async function syncAccountOrders(account: any): Promise<{ success: boolean; processed: number; error?: string }> {
  try {
    console.log(`🔄 [AUTO-SYNC] Sincronizando pedidos da conta: ${account.name}`);

    // Check if token expired and refresh if needed
    let accessToken = account.accessToken;
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt) < new Date()) {
      console.log('🔄 [AUTO-SYNC] Token expirado, renovando...');
      try {
        accessToken = await refreshAccessToken(account);
      } catch (refreshError: any) {
        console.error('❌ [AUTO-SYNC] Erro ao renovar token:', refreshError.message);
        return { success: false, processed: 0, error: 'Token expirado' };
      }
    }

    // Buscar apenas pedidos recentes (últimas 24 horas)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateFilter = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 5) { // Limitar a 5 páginas para auto-sync
      try {
        if (page > 1) {
          await new Promise(resolve => setTimeout(resolve, 300)); // Delay entre requisições
        }
        
        const response = await axios.get(`${BLING_API_URL}/pedidos/vendas?limite=100&pagina=${page}&dataInicial=${dateFilter}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        const orders = response.data?.data || [];
        allOrders = allOrders.concat(orders);

        if (orders.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } catch (apiError: any) {
        console.error(`❌ [AUTO-SYNC] Erro na API Bling para conta ${account.name}:`, apiError.message);
        hasMore = false;
      }
    }

    if (allOrders.length === 0) {
      console.log(`ℹ️ [AUTO-SYNC] Nenhum pedido recente encontrado para ${account.name}`);
      return { success: true, processed: 0 };
    }

    // Mapear status do Bling
    const statusMap: Record<number, string> = {
      0: 'Em Aberto', 1: 'Atendido', 2: 'Cancelado', 3: 'Em Andamento', 4: 'Venda Agenciada',
      5: 'Verificado', 6: 'Aguardando', 7: 'Não Entregue', 8: 'Entregue', 9: 'Em Digitação',
      10: 'Checado', 11: 'Enviado', 12: 'Pronto para Envio', 13: 'Pendente', 14: 'Faturado',
      15: 'Pronto', 16: 'Impresso', 17: 'Separado', 18: 'Embalado', 19: 'Coletado',
      20: 'Em Trânsito', 21: 'Devolvido', 22: 'Extraviado', 23: 'Tentativa de Entrega',
      24: 'Reagendado', 25: 'Bloqueado', 26: 'Suspenso', 27: 'Processando',
      28: 'Aprovado', 29: 'Reprovado', 30: 'Estornado',
    };

    // Processar pedidos
    let processedCount = 0;
    let autoProcessedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const order of allOrders) {
        try {
          // Mapear status
          const statusId = order.situacao?.id;
          const statusTexto = order.situacao?.valor || order.situacao?.nome || order.situacao?.descricao || '';
          
          let status: string;
          if (statusId !== undefined && statusMap[statusId]) {
            status = statusMap[statusId];
          } else if (statusTexto && typeof statusTexto === 'string' && statusTexto.trim().length > 0) {
            status = statusTexto.trim();
          } else if (statusId !== undefined) {
            status = `Status ${statusId}`;
          } else {
            status = 'Aguardando Processamento';
          }

          // Processar data
          let blingCreatedAt = null;
          if (order.data) {
            if (typeof order.data === 'string' && order.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
              blingCreatedAt = new Date(order.data + 'T12:00:00.000Z');
            } else {
              blingCreatedAt = new Date(order.data);
            }
          }

          // Verificar se o pedido já existe
          const existingOrder = await tx.blingOrder.findUnique({
            where: {
              blingOrderId_accountId: {
                blingOrderId: String(order.id),
                accountId: account.id,
              },
            },
          });

          const savedOrder = await tx.blingOrder.upsert({
            where: {
              blingOrderId_accountId: {
                blingOrderId: String(order.id),
                accountId: account.id,
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
              accountId: account.id,
              userId: account.userId,
              status,
              customerName: order.contato?.nome || null,
              totalAmount: order.total || 0,
              items: JSON.stringify(order.itens || []),
              blingCreatedAt,
            },
          });

          processedCount++;

          // 🚀 BAIXA AUTOMÁTICA APENAS para status "Verificado"
          if (status === 'Verificado' && !savedOrder.isProcessed) {
            console.log(`🔥 [AUTO-SYNC] Processando baixa automática para pedido #${order.numero} - Status: ${status}`);
            
            const items = order.itens || [];
            let produtosProcessados = 0;

            for (const item of items) {
              const sku = item.codigo || item.produto?.codigo;
              const quantidade = item.quantidade || 1;
              
              if (!sku) continue;

              // Buscar produto pelo SKU
              const product = await tx.product.findUnique({
                where: { sku },
              });

              if (product) {
                console.log(`📦 [AUTO-SYNC] Dando baixa: ${quantidade}x ${product.name} (SKU: ${sku})`);
                
                // Criar movimento de saída
                await tx.movement.create({
                  data: {
                    type: 'EXIT',
                    productId: product.id,
                    quantity: quantidade,
                    reason: `Baixa automática - Pedido Bling #${order.numero} (${status})`,
                    userId: account.userId,
                    syncStatus: 'synced',
                  },
                });
                
                produtosProcessados++;
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
            console.log(`✅ [AUTO-SYNC] Baixa automática concluída: ${produtosProcessados} produtos processados`);
          }
        } catch (orderError: any) {
          console.error(`❌ [AUTO-SYNC] Erro ao processar pedido ${order.numero}:`, orderError.message);
        }
      }
    });

    console.log(`🎉 [AUTO-SYNC] Conta ${account.name}: ${processedCount} pedidos, ${autoProcessedCount} com baixa automática`);
    return { success: true, processed: autoProcessedCount };

  } catch (error: any) {
    console.error(`❌ [AUTO-SYNC] Erro geral na conta ${account.name}:`, error.message);
    return { success: false, processed: 0, error: error.message };
  }
}

// Função principal de sincronização automática
export async function runAutoSync(): Promise<void> {
  try {
    console.log('🚀 [AUTO-SYNC] Iniciando sincronização automática...');

    // Buscar todas as contas ativas com tokens válidos
    const accounts = await prisma.blingAccount.findMany({
      where: {
        isActive: true,
        accessToken: { not: null },
        refreshToken: { not: null },
      },
    });

    if (accounts.length === 0) {
      console.log('ℹ️ [AUTO-SYNC] Nenhuma conta Bling ativa encontrada');
      return;
    }

    console.log(`📋 [AUTO-SYNC] Encontradas ${accounts.length} contas para sincronizar`);

    let totalProcessed = 0;
    for (const account of accounts) {
      const result = await syncAccountOrders(account);
      if (result.success) {
        totalProcessed += result.processed;
      }
      
      // Delay entre contas para evitar rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 [AUTO-SYNC] Sincronização concluída: ${totalProcessed} pedidos processados automaticamente`);

  } catch (error: any) {
    console.error('❌ [AUTO-SYNC] Erro na sincronização automática:', error.message);
  }
}

// Iniciar sincronização automática a cada 30 minutos
export function startAutoSync(): void {
  console.log('⏰ [AUTO-SYNC] Iniciando serviço de sincronização automática (30 min)');
  
  // Executar imediatamente na inicialização
  setTimeout(() => runAutoSync(), 5000); // 5 segundos após iniciar
  
  // Executar a cada 30 minutos (1800000 ms)
  setInterval(() => {
    runAutoSync();
  }, 30 * 60 * 1000);
}