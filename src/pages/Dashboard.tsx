import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import {
  DollarIcon,
  PackageIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  AlertIcon,
  LinkIcon,
  RefreshIcon,
} from '../components/Icons';

interface DashboardStats {
  todaySales: number;
  lowStockItems: number;
  activeProducts: number;
  blingAccounts: number;
  totalSales: number;
  recentSales: Array<{
    id: string;
    saleNumber: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    lowStockItems: 0,
    activeProducts: 0,
    blingAccounts: 0,
    totalSales: 0,
    recentSales: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardStats = [
    {
      title: 'Vendas Hoje',
      value: stats.todaySales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: <DollarIcon size={24} />,
      bgColor: isDarkMode ? 'bg-green-500/10' : 'bg-green-100',
      textColor: isDarkMode ? 'text-green-400' : 'text-green-600',
      path: '/sales',
      description: 'Ver todas as vendas'
    },
    {
      title: 'Estoque Baixo',
      value: `${stats.lowStockItems} itens`,
      icon: <AlertIcon size={24} />,
      bgColor: stats.lowStockItems > 0 
        ? (isDarkMode ? 'bg-red-500/10' : 'bg-red-100')
        : (isDarkMode ? 'bg-yellow-500/10' : 'bg-yellow-100'),
      textColor: stats.lowStockItems > 0
        ? (isDarkMode ? 'text-red-400' : 'text-red-600')
        : (isDarkMode ? 'text-yellow-400' : 'text-yellow-600'),
      path: '/products',
      description: 'Produtos com menos de 10 unidades'
    },
    {
      title: 'Produtos Ativos',
      value: stats.activeProducts.toString(),
      icon: <PackageIcon size={24} />,
      bgColor: isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-100',
      textColor: isDarkMode ? 'text-cyan-400' : 'text-cyan-600',
      path: '/products',
      description: 'Gerenciar produtos'
    },
    {
      title: 'Contas Bling',
      value: stats.blingAccounts.toString(),
      icon: <LinkIcon size={24} />,
      bgColor: isDarkMode ? 'bg-purple-500/10' : 'bg-purple-100',
      textColor: isDarkMode ? 'text-purple-400' : 'text-purple-600',
      path: '/accounts',
      description: 'Gerenciar contas'
    },
  ];

  const quickActions = [
    {
      title: 'Ver Produtos',
      description: 'Gerencie seu catálogo',
      icon: <PackageIcon size={24} />,
      path: '/products',
      color: 'from-cyan-500 to-blue-500',
    },
    {
      title: 'Ver Vendas',
      description: 'Acompanhe suas vendas',
      icon: <ShoppingCartIcon size={24} />,
      path: '/sales',
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Conectar Bling',
      description: 'Adicione uma conta',
      icon: <LinkIcon size={24} />,
      path: '/accounts',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Relatórios',
      description: 'Análises detalhadas',
      icon: <TrendingUpIcon size={24} />,
      path: '/reports',
      color: 'from-orange-500 to-red-500',
    },
  ];

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Dashboard
            </h1>
            <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Bem-vindo, {user?.name}! Visão geral do seu negócio.
            </p>
          </div>
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
              isDarkMode 
                ? 'bg-white/5 text-gray-300 hover:bg-white/10' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* Welcome Card */}
        <div className={`rounded-2xl p-6 mb-8 backdrop-blur-xl border transition-colors ${
          isDarkMode 
            ? 'bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 border-white/10' 
            : 'bg-gradient-to-r from-cyan-100 via-purple-100 to-pink-100 border-purple-200'
        }`}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                Total de Vendas
              </h2>
              <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {stats.totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-white/10' : 'bg-white/50'}`}>
              <TrendingUpIcon size={32} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {dashboardStats.map((stat, index) => (
            <button
              key={index}
              onClick={() => navigate(stat.path)}
              className={`rounded-2xl p-6 backdrop-blur-xl border transition-all duration-300 hover:scale-[1.02] text-left ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 hover:border-white/20' 
                  : 'bg-white border-gray-200 shadow-sm hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {stat.title}
                  </p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {loading ? '...' : stat.value}
                  </p>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    {stat.description}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <span className={stat.textColor}>{stat.icon}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Recent Sales */}
        {stats.recentSales.length > 0 && (
          <div className="mb-8">
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              Vendas Recentes
            </h3>
            <div className={`rounded-2xl border overflow-hidden ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
            }`}>
              <div className="divide-y divide-gray-200 dark:divide-white/10">
                {stats.recentSales.map((sale) => (
                  <div key={sale.id} className={`p-4 flex justify-between items-center ${
                    isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}>
                    <div>
                      <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {sale.saleNumber}
                      </p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {new Date(sale.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <p className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {sale.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Ações Rápidas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => navigate(action.path)}
              className={`p-6 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] group ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10 hover:border-white/20' 
                  : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-r ${action.color} text-white`}>
                {action.icon}
              </div>
              <h4 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {action.title}
              </h4>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {action.description}
              </p>
            </button>
          ))}
        </div>

        {/* System Status */}
        <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          Status do Sistema
        </h3>
        <div className={`rounded-2xl p-6 backdrop-blur-xl border ${
          isDarkMode 
            ? 'bg-white/5 border-white/10' 
            : 'bg-white border-gray-200 shadow-sm'
        }`}>
          <div className="space-y-3">
            <div className={`flex justify-between items-center py-3 border-b ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
            }`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                isDarkMode 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-green-100 text-green-700'
              }`}>
                Operacional
              </span>
            </div>
            <div className={`flex justify-between items-center py-3 border-b ${
              isDarkMode ? 'border-white/10' : 'border-gray-200'
            }`}>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Sincronizações Pendentes</span>
              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>0</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>Última Atualização</span>
              <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {new Date().toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
