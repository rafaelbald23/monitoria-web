import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { XIcon, ShoppingCartIcon, UserIcon, CalendarIcon, DollarIcon, PackageIcon } from './Icons';

interface OrderItem {
  codigo?: string;
  produto?: {
    id?: string;
    codigo?: string;
    nome?: string;
    ean?: string;
  };
  nome?: string;
  quantidade: number;
  valor?: number;
  valorTotal?: number;
  ean?: string;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  totalAmount: number;
  items: OrderItem[];
  isProcessed: boolean;
  createdAt: string;
  blingCreatedAt: string | null;
  processedAt: string | null;
  accountId?: string; // Add accountId
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  onProcessOrder?: (orderId: string) => void;
  onReprocessOrder?: (orderId: string) => void; // Nova prop
}

// Função auxiliar para testar kit
const testKit = async (accountId: string, productId: string) => {
  try {
    console.log('🧪 Iniciando teste de kit...');
    console.log('Account ID:', accountId);
    console.log('Product ID:', productId);
    
    const response = await fetch(`/api/bling/test-kit/${accountId}/${productId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
      },
    });
    const result = await response.json();
    
    console.log('📦 RESULTADO COMPLETO DO TESTE:', result);
    console.log('═══════════════════════════════════════════════════════');
    
    if (result.success) {
      console.log('✅ Teste executado com sucesso!');
      console.log('');
      console.log('📊 RESUMO:');
      console.log('  - É Kit:', result.isKit ? 'SIM ✅' : 'NÃO ❌');
      console.log('  - Componentes:', result.componentCount);
      console.log('');
      
      if (result.rawResponse) {
        console.log('📦 RESPOSTA COMPLETA DA API DO BLING:');
        console.log(JSON.stringify(result.rawResponse, null, 2));
        console.log('');
        
        const productData = result.rawResponse?.data;
        if (productData) {
          console.log('🔍 DADOS DO PRODUTO:');
          console.log('  - ID:', productData.id);
          console.log('  - Nome:', productData.nome);
          console.log('  - Código:', productData.codigo);
          console.log('');
          
          if (productData.estrutura) {
            console.log('🏗️ ESTRUTURA DO PRODUTO:');
            console.log('  - Tipo de Estoque:', productData.estrutura.tipoEstoque);
            console.log('  - Componentes:', productData.estrutura.componentes?.length || 0);
            console.log('');
            
            if (productData.estrutura.componentes && productData.estrutura.componentes.length > 0) {
              console.log('📦 COMPONENTES DO KIT (da rawResponse - só IDs):');
              productData.estrutura.componentes.forEach((comp: any, index: number) => {
                console.log(`  Componente ${index + 1}: ID ${comp.produto?.id}, Qtd: ${comp.quantidade}`);
              });
              console.log('');
            }
            
            // Mostrar componentes completos processados pelo backend
            if (result.components && result.components.length > 0) {
              console.log('📦 COMPONENTES COMPLETOS (processados pelo backend):');
              result.components.forEach((comp: any, index: number) => {
                console.log(`\n  Componente ${index + 1}:`);
                console.log(comp);
                console.log('    - ID:', comp.produto?.id);
                console.log('    - Nome:', comp.produto?.nome);
                console.log('    - Código/SKU:', comp.produto?.codigo);
                console.log('    - EAN (gtin):', comp.produto?.gtin || 'NÃO TEM');
                console.log('    - EAN Embalagem:', comp.produto?.gtinEmbalagem || 'NÃO TEM');
                console.log('    - Quantidade:', comp.quantidade);
              });
            } else {
              console.log('⚠️ Nenhum componente completo retornado pelo backend');
            }
            
            // 🔍 VERIFICAÇÃO DE ESTOQUE
            if (result.componentesComEstoque && result.componentesComEstoque.length > 0) {
              console.log('');
              console.log('🔍 VERIFICAÇÃO DE ESTOQUE:');
              result.componentesComEstoque.forEach((item: any, index: number) => {
                console.log(`\n  Componente ${index + 1}:`);
                console.log('    - EAN:', item.componente.produto?.gtin || 'N/A');
                console.log('    - SKU:', item.componente.produto?.codigo || 'N/A');
                console.log('    - Nome:', item.componente.produto?.nome || 'N/A');
                console.log('    - Encontrado no estoque:', item.encontradoNoEstoque ? '✅ SIM' : '❌ NÃO');
                console.log('    - Buscado por:', item.buscadoPor);
                if (item.produtoEstoque) {
                  console.log('    - Produto no estoque:', item.produtoEstoque.name);
                  console.log('    - EAN no estoque:', item.produtoEstoque.ean || 'N/A');
                  console.log('    - SKU no estoque:', item.produtoEstoque.sku);
                } else {
                  console.log('    ⚠️ PRODUTO NÃO CADASTRADO NO ESTOQUE!');
                }
              });
            }
          } else {
            console.log('⚠️ Produto não tem campo "estrutura"');
          }
        }
      }
      
      if (result.errorDetails) {
        console.error('❌ ERRO NA API DO BLING:');
        console.error(result.errorDetails);
      }
      
      console.log('═══════════════════════════════════════════════════════');
      
      const msg = `🧪 TESTE DE KIT\n\n` +
        `É Kit: ${result.isKit ? 'SIM ✅' : 'NÃO ❌'}\n` +
        `Componentes: ${result.componentCount}\n\n` +
        `✅ Verifique o CONSOLE (F12) para ver todos os detalhes!\n\n` +
        `O console mostra:\n` +
        `- Resposta completa da API do Bling\n` +
        `- Estrutura do produto\n` +
        `- Dados de cada componente\n` +
        `- Se tem EAN ou não`;
      
      alert(msg);
    } else {
      console.error('❌ Erro no teste:', result.error);
      alert(`❌ Erro: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Erro ao testar kit:', error);
    alert('❌ Erro ao testar kit');
  }
};

export default function OrderDetailsModal({ isOpen, onClose, order, onProcessOrder, onReprocessOrder }: OrderDetailsModalProps) {
  const { isDarkMode } = useTheme();
  const [productMatches, setProductMatches] = useState<Record<string, any>>({});

  useEffect(() => {
    if (order && isOpen) {
      // Buscar correspondências de produtos no estoque
      fetchProductMatches();
    }
  }, [order, isOpen]);

  const fetchProductMatches = async () => {
    if (!order) return;

    try {
      const response = await fetch('/api/bling/match-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ items: order.items }),
      });

      if (response.ok) {
        const result = await response.json();
        setProductMatches(result.matches || {});
      }
    } catch (error) {
      console.error('Erro ao buscar correspondências de produtos:', error);
    }
  };

  if (!isOpen || !order) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Verificado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Checado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Atendido': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      'Cancelado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Em Andamento': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Reagendado': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
    };
    return colors[status] || (isDarkMode ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-200');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl border max-w-4xl w-full max-h-[90vh] overflow-hidden ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <ShoppingCartIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Pedido #{order.orderNumber}
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Detalhes da venda do Bling
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <XIcon size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-6 space-y-6">
            {/* Informações Gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <UserIcon size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Cliente</span>
                </div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {order.customerName || 'Cliente não informado'}
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <DollarIcon size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Valor Total</span>
                </div>
                <p className={`font-semibold text-lg ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  {order.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarIcon size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Data do Pedido</span>
                </div>
                <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {formatDate(order.blingCreatedAt || order.createdAt)}
                </p>
              </div>

              <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <PackageIcon size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
                  <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                  {order.isProcessed && (
                    <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}>
                      ✓ Processado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Itens do Pedido */}
            <div>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Itens do Pedido ({order.items.length})
              </h3>
              
              {order.items.length === 0 ? (
                <div className={`p-8 text-center rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <PackageIcon size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
                  <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Nenhum item encontrado
                  </p>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Sincronize os pedidos novamente para buscar os items automaticamente.
                  </p>
                </div>
              ) : (
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Produto
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          SKU
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          EAN
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Qtd
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Valor Unit.
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Total
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Estoque
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                      {order.items.map((item, index) => {
                        const sku = item.codigo || item.produto?.codigo;
                        const nome = item.nome || item.produto?.nome;
                        const ean = item.ean || item.produto?.ean;
                        const blingProductId = item.produto?.id; // ID do produto no Bling
                        const match = (sku && productMatches[sku]) || (ean && productMatches[ean]) || (nome && productMatches[nome]);
                        
                        // Usar o nome do match (produto no estoque) como nome principal
                        const displayName = match?.name || nome || 'Sem descrição';
                        
                        // PROCV: Buscar EAN do produto no estoque pelo SKU
                        const displayEan = match?.ean || ean || '-';
                        
                        return (
                          <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              <div>
                                <p className="font-medium">{displayName}</p>
                                {match && match.name !== displayName && (
                                  <p className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                    ✓ Encontrado no estoque
                                  </p>
                                )}
                                {!match && nome && (
                                  <p className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                                    ⚠️ Não encontrado no estoque
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {sku || <span className="text-gray-500">-</span>}
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {displayEan !== '-' ? displayEan : <span className="text-gray-500">-</span>}
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {item.quantidade}
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {item.valor ? item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                            </td>
                            <td className={`px-4 py-3 text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              {item.valorTotal ? item.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 
                               (item.valor ? (item.valor * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-')}
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              {match ? (
                                <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                                  Estoque: {match.currentStock || 0}
                                </span>
                              ) : (
                                <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                  N/A
                                </span>
                              )}
                            </td>
                            <td className={`px-4 py-3 text-sm`}>
                              {blingProductId && order.accountId ? (
                                <button
                                  onClick={() => testKit(order.accountId!, blingProductId)}
                                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}
                                  title="Testar se é kit e ver componentes"
                                >
                                  🧪 Kit?
                                </button>
                              ) : (
                                <span className="text-gray-500 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-3">
              {!order.isProcessed && (order.status === 'Verificado' || order.status === 'Checado' || order.status === 'Atendido' || order.status === 'Despachado') && onProcessOrder && (
                <button
                  onClick={() => onProcessOrder(order.id)}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                >
                  Processar Baixa no Estoque
                </button>
              )}
              
              {order.isProcessed && onReprocessOrder && (
                <button
                  onClick={() => {
                    if (confirm('⚠️ ATENÇÃO!\n\nEste pedido já foi processado. Reprocessar vai dar baixa novamente nos produtos.\n\nTem certeza que deseja reprocessar?')) {
                      onReprocessOrder(order.id);
                    }
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl hover:opacity-90 transition-opacity font-medium flex items-center gap-2"
                >
                  🔄 Reprocessar com Lógica de Kits
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}