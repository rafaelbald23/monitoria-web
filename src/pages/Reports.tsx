import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { RefreshIcon, PackageIcon, ShoppingCartIcon, DollarIcon, LinkIcon, TrendingUpIcon, AlertIcon } from '../components/Icons';

export default function Reports() {
  const { isDarkMode } = useTheme();
  const [stats, setStats] = useState({
    totalProducts: 0, totalSales: 0, totalRevenue: 0, activeAccounts: 0, lowStockProducts: 0,
    todaySales: 0, todayRevenue: 0, weekSales: 0, weekRevenue: 0, monthSales: 0, monthRevenue: 0
  });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [products, sales, accounts] = await Promise.all([
        api.getProducts(),
        api.getSales(),
        api.getAccounts()
      ]);

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const todaySalesData = sales.filter((sale: any) => new Date(sale.createdAt) >= today);
      const weekSalesData = sales.filter((sale: any) => new Date(sale.createdAt) >= weekAgo);
      const monthSalesData = sales.filter((sale: any) => new Date(sale.createdAt) >= monthAgo);

      const totalRevenue = sales.reduce((sum: number, sale: any) => sum + sale.totalAmount, 0);
      const activeAccounts = accounts.filter((acc: any) => acc.isActive).length;
      const lowStockProducts = products.filter((p: any) => p.stock < 10).length;

      setStats({
        totalProducts: products.length,
        totalSales: sales.length,
        totalRevenue,
        activeAccounts,
        lowStockProducts,
        todaySales: todaySalesData.length,
        todayRevenue: todaySalesData.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
        weekSales: weekSalesData.length,
        weekRevenue: weekSalesData.reduce((sum: number, s: any) => sum + s.totalAmount, 0),
        monthSales: monthSalesData.length,
        monthRevenue: monthSalesData.reduce((sum: number, s: any) => sum + s.totalAmount, 0)
      });

      setRecentSales(sales.slice(0, 10));
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const mainStats = [
    { title: 'Total de Produtos', value: stats.totalProducts.toString(), icon: <PackageIcon size={28} />, bgColor: isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100', textColor: isDarkMode ? 'text-cyan-400' : 'text-cyan-600' },
    { title: 'Total de Vendas', value: stats.totalSales.toString(), icon: <ShoppingCartIcon size={28} />, bgColor: isDarkMode ? 'bg-purple-500/10' : 'bg-purple-100', textColor: isDarkMode ? 'text-purple-400' : 'text-purple-600' },
    { title: 'Receita Total', value: formatCurrency(stats.totalRevenue), icon: <DollarIcon size={28} />, bgColor: isDarkMode ? 'bg-green-500/10' : 'bg-green-100', textColor: isDarkMode ? 'text-green-400' : 'text-green-600' },
    { title: 'Contas Ativas', value: stats.activeAccounts.toString(), icon: <LinkIcon size={28} />, bgColor: isDarkMode ? 'bg-pink-500/10' : 'bg-pink-100', textColor: isDarkMode ? 'text-pink-400' : 'text-pink-600' },
  ];

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Relatórios</h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Análise completa do seu negócio</p>
          </div>
          <button onClick={loadStats} disabled={loading} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando relatórios...
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {mainStats.map((stat, index) => (
                <div key={index} className={`rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{stat.title}</p>
                      <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
                    </div>
                    <div className={`p-4 rounded-xl ${stat.bgColor}`}>
                      <span className={stat.textColor}>{stat.icon}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Period Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                    <TrendingUpIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
                  </div>
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Hoje</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Vendas</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.todaySales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Receita</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{formatCurrency(stats.todayRevenue)}</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                    <TrendingUpIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
                  </div>
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Últimos 7 dias</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Vendas</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.weekSales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Receita</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{formatCurrency(stats.weekRevenue)}</span>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                    <TrendingUpIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                  </div>
                  <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Últimos 30 dias</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Vendas</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.monthSales}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Receita</span>
                    <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{formatCurrency(stats.monthRevenue)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alerts */}
            <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Alertas</h3>
              <div className="space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-xl ${stats.lowStockProducts > 0 ? isDarkMode ? 'bg-yellow-500/10' : 'bg-yellow-50' : isDarkMode ? 'bg-green-500/10' : 'bg-green-50'}`}>
                  <div className="flex items-center gap-3">
                    <AlertIcon size={20} className={stats.lowStockProducts > 0 ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600' : isDarkMode ? 'text-green-400' : 'text-green-600'} />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Produtos com estoque baixo</span>
                  </div>
                  <span className={`font-semibold ${stats.lowStockProducts > 0 ? isDarkMode ? 'text-yellow-400' : 'text-yellow-600' : isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.lowStockProducts}</span>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-xl ${isDarkMode ? 'bg-green-500/10' : 'bg-green-50'}`}>
                  <div className="flex items-center gap-3">
                    <LinkIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
                    <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Status do Sistema</span>
                  </div>
                  <span className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>Operacional</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
