import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { CloseIcon, ShoppingCartIcon, UserIcon, CalendarIcon, DollarIcon, PackageIcon } from './Icons';

interface OrderItem {
  codigo?: string;
  produto?: {
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
}

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderDetails | null;
  onProcessOrder?: (orderId: string) => void;
}

export default function OrderDetailsModal({ isOpen, onClose, order, onProcessOrder }: OrderDetailsModalProps) {
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
            <CloseIcon size={20} className={isDarkMode ? 'text-gray-400' : 'text-gray-600'} />
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
              <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Produto
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          SKU/EAN
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
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                      {order.items.map((item, index) => {
                        const sku = item.codigo || item.produto?.codigo;
                        const nome = item.nome || item.produto?.nome;
                        const ean = item.ean || item.produto?.ean;
                        const match = productMatches[sku] || productMatches[ean] || productMatches[nome];
                        
                        return (
                          <tr key={index} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                            <td className={`px-4 py-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              <div>
                                <p className="font-medium">{nome || 'Produto sem nome'}</p>
                                {match && (
                                  <p className={`text-xs ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                    ✓ Encontrado no estoque: {match.name}
                                  </p>
                                )}
                                {!match && (
                                  <p className={`text-xs ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                                    ⚠️ Não encontrado no estoque
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                              <div>
                                {sku && <p>SKU: {sku}</p>}
                                {ean && <p>EAN: {ean}</p>}
                                {!sku && !ean && <p className="text-gray-500">-</p>}
                              </div>
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Ações */}
            {!order.isProcessed && (order.status === 'Verificado' || order.status === 'Checado') && onProcessOrder && (
              <div className="flex justify-end">
                <button
                  onClick={() => onProcessOrder(order.id)}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                >
                  Processar Baixa no Estoque
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}