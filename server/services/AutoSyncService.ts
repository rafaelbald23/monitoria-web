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

// Função para buscar detalhes completos de um pedido
async function fetchOrderDetails(orderId: string, accessToken: string): Promise<any> {
  try {
    console.log(`🔍 [AUTO-SYNC] Buscando detalhes completos do pedido #${orderId}...`);
    const response = await axios.get(`${BLING_API_URL}/pedidos/vendas/${orderId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });
    
    if (response.data?.data) {
      console.log(`✅ [AUTO-SYNC] Detalhes completos obtidos com ${(response.data.data.itens || []).length} itens`);
      return response.data.data;
    }
  } catch (error: any) {
    console.log(`⚠️ [AUTO-SYNC] Erro ao buscar detalhes: ${error.message}`);
  }
  
  return null;
}

// Função para buscar componentes de um kit na API do Bling
async function fetchKitComponents(productId: string, accessToken: string): Promise<any[]> {
  try {
    console.log(`🎁 [AUTO-SYNC] Buscando componentes do kit (produto ID: ${productId})...`);
    const response = await axios.get(`${BLING_API_URL}/produtos/${productId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });
    
    const productData = response.data?.data;
    
    // Verificar se é um kit (tipoEstoque = 'F' de Fabricado/Kit)
    if (productData?.estrutura?.tipoEstoque === 'F' && productData?.estrutura?.componentes) {
      const componentes = productData.estrutura.componentes;
      console.log(`✅ [AUTO-SYNC] Kit detectado com ${componentes.length} componentes`);
      return componentes;
    }
    
    console.log(`ℹ️ [AUTO-SYNC] Produto não é um kit ou não tem componentes`);
    return [];
  } catch (error: any) {
    console.log(`⚠️ [AUTO-SYNC] Erro ao buscar componentes do kit: ${error.message}`);
    return [];
  }
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
    // CORREÇÃO CRÍTICA: ID 24 deve ser "Verificado" não "Reagendado"
    const statusMap: Record<number, string> = {
      0: 'Em Aberto', 1: 'Atendido', 2: 'Cancelado', 3: 'Em Andamento', 4: 'Venda Agenciada',
      5: 'Verificado', 6: 'Aguardando', 7: 'Não Entregue', 8: 'Entregue', 9: 'Atendido',
      10: 'Checado', 11: 'Enviado', 12: 'Cancelado', 13: 'Pendente', 14: 'Faturado',
      15: 'Pronto', 16: 'Impresso', 17: 'Separado', 18: 'Embalado', 19: 'Coletado',
      20: 'Em Trânsito', 21: 'Devolvido', 22: 'Extraviado', 23: 'Tentativa de Entrega',
      24: 'Verificado', // CORREÇÃO: Era "Reagendado", agora é "Verificado"
      25: 'Bloqueado', 26: 'Suspenso', 27: 'Processando',
      28: 'Aprovado', 29: 'Reprovado', 30: 'Estornado',
      598239: 'Despachado', // ID customizado do cliente
    };

    // Processar pedidos
    let processedCount = 0;
    let autoProcessedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const order of allOrders) {
        try {
          // 🔍 BUSCAR DETALHES COMPLETOS DO PEDIDO para garantir que temos todos os items
          const orderDetails = await fetchOrderDetails(order.id, accessToken);
          const orderToUse = orderDetails || order;
          
          console.log(`📦 [AUTO-SYNC] Pedido #${orderToUse.numero} - Items: ${(orderToUse.itens || []).length}`);
          
          // MAPEAMENTO DE STATUS MELHORADO - Igual ao bling.ts
          const statusId = orderToUse.situacao?.id;
          
          // LOG COMPLETO da estrutura para debug
          console.log(`📋 [AUTO-SYNC] ANÁLISE Pedido #${orderToUse.numero}:`);
          console.log(`   - situacao:`, JSON.stringify(orderToUse.situacao, null, 2));
          
          // 🔍 CAPTURAR STATUS PARA MAPEAMENTO
          if (orderToUse.situacao?.id !== undefined) {
            console.log(`🎯 [AUTO-SYNC] STATUS CAPTURADO: ID=${orderToUse.situacao.id}, Nome="${orderToUse.situacao.nome || orderToUse.situacao.valor || 'N/A'}"`);
          }
          
          // NOVA ESTRATÉGIA: Testar TODOS os campos possíveis da situacao
          const possibleStatusFields = [
            // Campos mais comuns da API Bling v3
            orderToUse.situacao?.nome,           // Campo principal na v3
            orderToUse.situacao?.descricao,      // Campo alternativo
            orderToUse.situacao?.valor,          // Campo de valor
            orderToUse.situacao?.texto,          // Campo de texto
            orderToUse.situacao?.status,         // Campo status direto
            orderToUse.situacao?.situacao,       // Campo situacao aninhado
            // Campos do pedido principal
            orderToUse.status,
            orderToUse.situacao_nome,
            orderToUse.situacao_descricao,
            // Campos aninhados se existirem
            orderToUse.situacao?.situacao?.nome,
            orderToUse.situacao?.situacao?.descricao,
            orderToUse.situacao?.situacao?.valor,
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
          console.log(`   - statusTexto: "${statusTexto}" (${foundField})`);
          
          // PRIORIZAR ID sobre texto
          let status: string;
          if (statusId !== undefined && statusMap[statusId]) {
            status = statusMap[statusId];
            console.log(`✅ [AUTO-SYNC] Status pelo ID ${statusId}: "${status}"`);
          } else if (statusTexto && statusTexto.length > 0) {
            status = statusTexto;
            console.log(`✅ [AUTO-SYNC] Status pelo TEXTO: "${status}"`);
          } else if (statusId !== undefined) {
            status = `Status ${statusId}`;
            console.log(`⚠️ [AUTO-SYNC] Status não mapeado: "${status}"`);
          } else {
            status = 'Aguardando Processamento';
            console.log(`❌ [AUTO-SYNC] Status padrão: "${status}"`);
          }

          // Processar data
          let blingCreatedAt: Date | null = null;
          if (orderToUse.data) {
            if (typeof orderToUse.data === 'string' && orderToUse.data.match(/^\d{4}-\d{2}-\d{2}$/)) {
              blingCreatedAt = new Date(orderToUse.data + 'T12:00:00.000Z');
            } else {
              blingCreatedAt = new Date(orderToUse.data);
            }
          }

          // Verificar se o pedido já existe
          const existingOrder = await tx.blingOrder.findUnique({
            where: {
              blingOrderId_accountId: {
                blingOrderId: String(orderToUse.id),
                accountId: account.id,
              },
            },
          });

          const savedOrder = await tx.blingOrder.upsert({
            where: {
              blingOrderId_accountId: {
                blingOrderId: String(orderToUse.id),
                accountId: account.id,
              },
            },
            update: {
              status,
              customerName: orderToUse.contato?.nome || null,
              totalAmount: orderToUse.total || 0,
              items: JSON.stringify(orderToUse.itens || []),
              updatedAt: new Date(),
            },
            create: {
              blingOrderId: String(orderToUse.id),
              orderNumber: String(orderToUse.numero || orderToUse.id),
              accountId: account.id,
              userId: account.userId,
              status,
              customerName: orderToUse.contato?.nome || null,
              totalAmount: orderToUse.total || 0,
              items: JSON.stringify(orderToUse.itens || []),
              blingCreatedAt,
            },
          });

          processedCount++;

          // 🚀 BAIXA AUTOMÁTICA com verificação melhorada
          const statusNormalized = status.toLowerCase().trim();
          const statusParaBaixa = [
            'verificado', 'checado', 'atendido', 'despachado', 'aprovado', 'pronto para envio',
            'verified', 'checked', 'approved', 'ready to ship'
          ];
          const needsProcessing = statusParaBaixa.includes(statusNormalized);
          
          if (needsProcessing && !savedOrder.isProcessed) {
            console.log(`🔥 [AUTO-SYNC] Processando baixa automática para pedido #${orderToUse.numero} - Status: ${status}`);
            
            const items = orderToUse.itens || [];
            let produtosProcessados = 0;

            for (const item of items) {
              const sku = item.codigo || item.produto?.codigo;
              const nome = item.nome || item.produto?.nome;
              const quantidade = item.quantidade || 1;
              const blingProductId = item.produto?.id;
              
              // 🎁 VERIFICAR SE É KIT - Buscar componentes na API do Bling
              let isKit = false;
              let kitComponents: any[] = [];
              
              if (blingProductId) {
                kitComponents = await fetchKitComponents(String(blingProductId), accessToken);
                isKit = kitComponents.length > 0;
                
                if (isKit) {
                  console.log(`🎁 [AUTO-SYNC] KIT DETECTADO: "${nome}" com ${kitComponents.length} componentes`);
                }
              }

              // Se for kit, processar componentes individualmente
              if (isKit && kitComponents.length > 0) {
                console.log(`🎁 [AUTO-SYNC] Processando componentes do kit "${nome}"...`);
                
                for (const componente of kitComponents) {
                  const compSku = componente.produto?.codigo;
                  const compNome = componente.produto?.nome;
                  const compEan = componente.produto?.gtin || componente.produto?.gtinEmbalagem; // EAN do componente
                  const compQtd = (componente.quantidade || 1) * quantidade;
                  
                  console.log(`  📦 [AUTO-SYNC] Componente: SKU="${compSku}", EAN="${compEan}", Nome="${compNome}", Qtd=${compQtd}`);
                  
                  // Buscar componente no estoque - PRIORIDADE: EAN > SKU > Nome
                  let compProduct: any = null;
                  
                  // 1. PRIORIDADE: Buscar por EAN (double check da Bling)
                  if (compEan) {
                    compProduct = await tx.product.findFirst({
                      where: { ean: compEan }
                    });
                    if (compProduct) {
                      console.log(`  ✅ [AUTO-SYNC] Componente encontrado por EAN: ${compProduct.name}`);
                    }
                  }
                  
                  // 2. Se não encontrou por EAN, buscar por SKU
                  if (!compProduct && compSku) {
                    compProduct = await tx.product.findFirst({
                      where: {
                        OR: [
                          { sku: compSku },
                          { internalCode: compSku }
                        ]
                      }
                    });
                    if (compProduct) {
                      console.log(`  ✅ [AUTO-SYNC] Componente encontrado por SKU: ${compProduct.name}`);
                    }
                  }
                  
                  // 3. Se não encontrou por EAN/SKU, buscar por nome
                  if (!compProduct && compNome) {
                    compProduct = await tx.product.findFirst({
                      where: {
                        name: {
                          contains: compNome
                        }
                      }
                    });
                    if (compProduct) {
                      console.log(`  ✅ [AUTO-SYNC] Componente encontrado por Nome: ${compProduct.name}`);
                    }
                  }
                  
                  if (compProduct) {
                    console.log(`  📦 [AUTO-SYNC] DANDO BAIXA: ${compQtd}x ${compProduct.name} (EAN: ${compProduct.ean || 'N/A'}, SKU: ${compProduct.sku})`);
                    
                    await tx.movement.create({
                      data: {
                        type: 'EXIT',
                        productId: compProduct.id,
                        quantity: compQtd,
                        reason: `Baixa automática (Kit: ${nome}) - Pedido #${orderToUse.numero}`,
                        userId: account.userId,
                        syncStatus: 'synced',
                      },
                    });
                    
                    produtosProcessados++;
                  } else {
                    console.log(`  ⚠️ [AUTO-SYNC] Componente não encontrado: EAN="${compEan}", SKU="${compSku}", Nome="${compNome}"`);
                  }
                }
                
                console.log(`✅ [AUTO-SYNC] Kit "${nome}" processado`);
                
              } else {
                // NÃO É KIT - Processar normalmente
                if (!sku) continue;

                const product = await tx.product.findUnique({
                  where: { sku },
                });

                if (product) {
                  console.log(`📦 [AUTO-SYNC] Dando baixa: ${quantidade}x ${product.name} (SKU: ${sku})`);
                  
                  await tx.movement.create({
                    data: {
                      type: 'EXIT',
                      productId: product.id,
                      quantity: quantidade,
                      reason: `Baixa automática - Pedido Bling #${orderToUse.numero} (${status})`,
                      userId: account.userId,
                      syncStatus: 'synced',
                    },
                  });
                  
                  produtosProcessados++;
                }
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

          // 🔴 PROCESSAR CANCELAMENTO - Devolver ao estoque se necessário
          const isCancelled = status.toLowerCase().includes('cancelado');
          
          if (isCancelled && savedOrder.isProcessed && !savedOrder.isCancelled) {
            console.log(`🔴 [AUTO-SYNC] PROCESSANDO CANCELAMENTO para pedido #${orderToUse.numero} - Devolvendo ao estoque`);
            
            const items = orderToUse.itens || [];
            let produtosDevolvidos = 0;

            for (const item of items) {
              const sku = item.codigo || item.produto?.codigo;
              const quantidade = item.quantidade || 1;
              
              if (!sku) continue;

              const product = await tx.product.findUnique({
                where: { sku },
              });

              if (product) {
                console.log(`↩️ [AUTO-SYNC] DEVOLVENDO: ${quantidade}x ${product.name} (SKU: ${sku})`);
                
                // Criar movimento de ENTRADA para devolver ao estoque
                await tx.movement.create({
                  data: {
                    type: 'ENTRY',
                    productId: product.id,
                    quantity: quantidade,
                    reason: `Devolução por cancelamento - Pedido #${orderToUse.numero}`,
                    userId: account.userId,
                    syncStatus: 'synced',
                  },
                });
                
                produtosDevolvidos++;
              }
            }

            // Marcar como cancelado
            await tx.blingOrder.update({
              where: { id: savedOrder.id },
              data: {
                isCancelled: true,
                cancelledAt: new Date(),
              },
            });

            console.log(`✅ [AUTO-SYNC] CANCELAMENTO PROCESSADO: ${produtosDevolvidos} produtos devolvidos ao estoque`);
          } else if (isCancelled && !savedOrder.isProcessed && !savedOrder.isCancelled) {
            // Pedido cancelado mas nunca teve baixa, apenas marcar como cancelado
            await tx.blingOrder.update({
              where: { id: savedOrder.id },
              data: {
                isCancelled: true,
                cancelledAt: new Date(),
              },
            });
            console.log(`ℹ️ [AUTO-SYNC] Pedido #${orderToUse.numero} cancelado (sem baixa prévia)`);
          } else if (isCancelled && savedOrder.isCancelled) {
            console.log(`ℹ️ [AUTO-SYNC] Pedido #${orderToUse.numero} já foi marcado como cancelado anteriormente`);
          }
        } catch (orderError: any) {
          console.error(`❌ [AUTO-SYNC] Erro ao processar pedido ${order.numero}:`, orderError.message);
        }
        
        // Delay para respeitar rate limit (buscar detalhes é uma requisição extra)
        await new Promise(resolve => setTimeout(resolve, 400));
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