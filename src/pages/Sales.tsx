import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { RefreshIcon, FilterIcon, PlusIcon, DollarIcon, ShoppingCartIcon } from '../components/Icons';
import { ExportButton } from '../components/ExportButton';
import { exportToCSV, exportToPDF, generateTableHTML } from '../utils/export';

interface BlingOrder {
  id: string;
  blingOrderId: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  totalAmount: number;
  items: any[];
  isProcessed: boolean;
  createdAt: string;
  blingCreatedAt: string | null;
}

interface Account {
  id: string;
  name: string;
  isActive: boolean;
}

export default function Sales() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [blingOrders, setBlingOrders] = useState<BlingOrder[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, verified: 0, processed: 0 });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      loadBlingOrders();
    }
  }, [accounts]);

  const loadAccounts = async () => {
    try {
      const result = await api.getAccounts() as Account[];
      setAccounts(result.filter(acc => acc.isActive));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadBlingOrders = async () => {
    try {
      setLoading(true);
      let allOrders: BlingOrder[] = [];
      
      for (const account of accounts) {
        const result = await api.getAllBlingOrders(account.id) as any;
        if (result.success && result.orders) {
          allOrders = [...allOrders, ...result.orders.map((o: any) => ({ ...o, accountName: account.name }))];
        }
      }
      
      // Ordenar por data mais recente
      allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBlingOrders(allOrders);
      
      // Calcular estatísticas
      setStats({
        totalOrders: allOrders.length,
        totalRevenue: allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        verified: allOrders.filter(o => o.status === 'Verificado' || o.status === 'Checado').length,
        processed: allOrders.filter(o => o.isProcessed).length,
      });
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      let totalSynced = 0;
      for (const account of accounts) {
        console.log('Sincronizando conta:', account.name, account.id);
        const result = await api.getBlingOrders(account.id) as any;
        console.log('Resultado sync:', result);
        if (result.success && result.orders) {
          totalSynced += result.orders.length;
        }
      }
      console.log('Total sincronizado:', totalSynced);
      await loadBlingOrders();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Verificado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Checado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Atendido': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      'Em Andamento': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Em Aberto': isDarkMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200',
      'Cancelado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Enviado': isDarkMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Entregue': isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Pronto para Envio': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return colors[status] || (isDarkMode ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-200');
  };

  const allStatuses = ['all', 'Verificado', 'Checado', 'Atendido', 'Em Andamento', 'Em Aberto', 'Cancelado', 'Enviado', 'Entregue', 'Pronto para Envio'];
  
  const filteredOrders = blingOrders.filter(order => filter === 'all' || order.status === filter);

  const columns = [
    { key: 'orderNumber', label: 'Pedido' },
    { key: 'blingCreatedAt', label: 'Data' },
    { key: 'customerName', label: 'Cliente' },
    { key: 'totalAmount', label: 'Valor' },
    { key: 'status', label: 'Status' },
  ];

  const handleExportCSV = () => exportToCSV(filteredOrders, 'pedidos-bling', columns);
  const handleExportPDF = () => {
    const tableHTML = generateTableHTML(filteredOrders, columns);
    exportToPDF('Pedidos Bling - Últimos 3 Meses', tableHTML);
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={"text-2xl font-bold " + (isDarkMode ? 'text-white' : 'text-gray-900')}>Vendas / Pedidos Bling</h1>
            <p className={"text-sm " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>Pedidos dos últimos 3 meses sincronizados do Bling</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            <button onClick={handleSyncOrders} disabled={syncing} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-purple-600/30 text-purple-400 hover:bg-purple-600/40 border border-purple-500/30 transition-all disabled:opacity-50">
              <RefreshIcon size={18} className={syncing ? 'animate-spin' : ''} />
              Sincronizar Bling
            </button>
            <button onClick={() => navigate('/new-sale')} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              <PlusIcon size={18} />
              Nova Venda
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Total Pedidos</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-white' : 'text-gray-900')}>{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-green-500/20' : 'bg-green-100')}>
                <DollarIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Receita Total</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-green-400' : 'text-green-600')}>{stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Verificados</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')}>{stats.verified}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Processados</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}>{stats.processed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="relative">
            <div className={"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
              <FilterIcon size={16} />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={"pl-10 pr-8 py-2 rounded-xl border outline-none appearance-none cursor-pointer transition-colors " + (isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50')}>
              <option value="all" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Todos os Status</option>
              {allStatuses.filter(s => s !== 'all').map(status => (
                <option key={status} value={status} className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>{status}</option>
              ))}
            </select>
          </div>
          <span className={"text-sm " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>{filteredOrders.length} pedido(s)</span>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className={"text-center py-8 " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando pedidos...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={"text-center py-16 rounded-2xl border " + (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500')}>
            <ShoppingCartIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum pedido encontrado</p>
            <button onClick={handleSyncOrders} className="text-purple-500 hover:text-purple-400 font-medium">Sincronizar com Bling</button>
          </div>
        ) : (
          <div className={"rounded-2xl border overflow-hidden " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                  <tr>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Pedido</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Data</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Cliente</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Valor</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Status</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Baixa</th>
                  </tr>
                </thead>
                <tbody className={"divide-y " + (isDarkMode ? 'divide-white/10' : 'divide-gray-200')}>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className={"transition-colors " + (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50')}>
                      <td className={"px-6 py-4 whitespace-nowrap text-sm font-medium " + (isDarkMode ? 'text-white' : 'text-gray-900')}>#{order.orderNumber}</td>
                      <td className={"px-6 py-4 whitespace-nowrap text-sm " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>{order.blingCreatedAt ? new Date(order.blingCreatedAt).toLocaleDateString('pt-BR') : new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className={"px-6 py-4 whitespace-nowrap text-sm " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>{order.customerName || '-'}</td>
                      <td className={"px-6 py-4 whitespace-nowrap text-sm font-semibold " + (isDarkMode ? 'text-green-400' : 'text-green-600')}>{(order.totalAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={"px-3 py-1 rounded-full text-xs font-medium border " + getStatusColor(order.status)}>{order.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.isProcessed ? (
                          <span className={"px-2 py-1 rounded text-xs " + (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')}>✓ Processado</span>
                        ) : (order.status === 'Verificado' || order.status === 'Checado') ? (
                          <button onClick={() => navigate('/new-sale')} className={"px-2 py-1 rounded text-xs font-medium " + (isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200')}>
                            Dar Baixa
                          </button>
                        ) : (
                          <span className={"text-xs " + (isDarkMode ? 'text-gray-500' : 'text-gray-400')}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
