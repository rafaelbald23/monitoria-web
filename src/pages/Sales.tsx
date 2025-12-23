import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { RefreshIcon, FilterIcon, PlusIcon, DollarIcon, ShoppingCartIcon } from '../components/Icons';

interface Sale {
  id: string;
  saleNumber: string;
  customerName?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  accountName: string;
  fiscalNoteStatus?: string;
  fiscalNoteNumber?: string;
}

export default function Sales() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0, todaySales: 0, todayRevenue: 0 });

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      setLoading(true);
      const result = await api.getSales();
      setSales(result);
      
      const today = new Date().toDateString();
      const todaySalesData = result.filter((sale: Sale) => new Date(sale.createdAt).toDateString() === today);
      
      setStats({
        totalSales: result.length,
        totalRevenue: result.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0),
        todaySales: todaySalesData.length,
        todayRevenue: todaySalesData.reduce((sum: number, sale: Sale) => sum + sale.totalAmount, 0)
      });
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(sale => filter === 'all' || sale.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700';
      case 'pending': return isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700';
      default: return isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluída';
      case 'pending': return 'Pendente';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Vendas</h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Histórico de vendas e notas fiscais</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadSales} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button onClick={() => navigate('/new-sale')} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              <PlusIcon size={18} />
              Nova Venda
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                <DollarIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
              </div>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vendas Hoje</p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.todaySales}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                <DollarIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
              </div>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Receita Hoje</p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.todayRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              </div>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Vendas</p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.totalSales}</p>
              </div>
            </div>
          </div>
          <div className={`rounded-xl p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-pink-500/20' : 'bg-pink-100'}`}>
                <DollarIcon size={20} className={isDarkMode ? 'text-pink-400' : 'text-pink-600'} />
              </div>
              <div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Receita Total</p>
                <p className={`text-lg font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <FilterIcon size={16} />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`pl-10 pr-8 py-2 rounded-xl border outline-none appearance-none cursor-pointer transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'}`}>
              <option value="all" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Todas</option>
              <option value="completed" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Concluídas</option>
              <option value="pending" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Pendentes</option>
              <option value="cancelled" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Canceladas</option>
            </select>
          </div>
          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{filteredSales.length} venda(s) encontrada(s)</span>
        </div>

        {/* Sales Table */}
        {loading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando vendas...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
            <ShoppingCartIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhuma venda encontrada</p>
            <button onClick={() => navigate('/new-sale')} className="text-cyan-500 hover:text-cyan-400 font-medium">Registrar primeira venda</button>
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Pedido</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Data/Hora</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Valor</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Conta Bling</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{sale.saleNumber}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{new Date(sale.createdAt).toLocaleString('pt-BR')}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{sale.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(sale.status)}`}>{getStatusLabel(sale.status)}</span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{sale.accountName || 'N/A'}</td>
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
