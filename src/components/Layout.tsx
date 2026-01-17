import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Logo } from './Logo';
import BackupModal from './BackupModal';
import { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  DashboardIcon,
  PackageIcon,
  ShoppingCartIcon,
  LinkIcon,
  ChartIcon,
  SettingsIcon,
  LogoutIcon,
  SunIcon,
  MoonIcon,
  PlusIcon,
  CrownIcon,
  UsersIcon,
} from './Icons';

interface LayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  permission?: string;
  masterOnly?: boolean;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [showBackupModal, setShowBackupModal] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isMaster = user?.isMaster === true;
  const isOwner = user?.isOwner === true;

  // Verificar se precisa mostrar modal de backup
  useEffect(() => {
    const checkBackupNeeded = async () => {
      try {
        // Só verificar para usuários normais (não master)
        if (!isMaster && user?.id) {
          const result: any = await api.checkBackupNeeded();
          if (result.needsBackup) {
            // Aguardar 2 segundos após o login para mostrar o modal
            setTimeout(() => {
              setShowBackupModal(true);
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Erro ao verificar necessidade de backup:', error);
      }
    };

    checkBackupNeeded();
  }, [user?.id, isMaster]);

  const handleBackupComplete = () => {
    setShowBackupModal(false);
  };

  const menuItems: MenuItem[] = [
    { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon size={20} />, permission: 'dashboard' },
    { path: '/products', label: 'Produtos', icon: <PackageIcon size={20} />, permission: 'products' },
    { path: '/new-sale', label: 'Nova Venda', icon: <PlusIcon size={20} />, permission: 'newSale' },
    { path: '/sales', label: 'Vendas', icon: <ShoppingCartIcon size={20} />, permission: 'sales' },
    { path: '/accounts', label: 'Contas Bling', icon: <LinkIcon size={20} />, permission: 'accounts' },
    { path: '/reports', label: 'Relatórios', icon: <ChartIcon size={20} />, permission: 'reports' },
    { path: '/employees', label: 'Funcionários', icon: <UsersIcon size={20} />, permission: 'users' },
    { path: '/settings', label: 'Configurações', icon: <SettingsIcon size={20} />, permission: 'settings' },
    { path: '/master', label: 'Painel Master', icon: <CrownIcon size={20} />, masterOnly: true },
  ];

  // Filtra itens do menu baseado nas permissões do usuário
  const visibleMenuItems = menuItems.filter(item => {
    if (item.masterOnly) return isMaster;
    if (isMaster) return false; // Master só vê o painel master
    if (isOwner) return !item.masterOnly; // Dono vê tudo exceto master
    return item.permission ? hasPermission(item.permission) : true;
  });

  return (
    <div className={`flex h-screen transition-colors duration-300 ${
      isDarkMode ? 'bg-slate-900' : 'bg-gray-100'
    }`}>
      {/* Sidebar */}
      <aside className={`w-64 flex flex-col transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-slate-800/50 backdrop-blur-xl border-r border-white/10' 
          : 'bg-white shadow-lg border-r border-gray-200'
      }`}>
        {/* Logo Section */}
        <div className={`p-6 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                monitorIA
              </h1>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Gestão de Estoque
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {visibleMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive(item.path)
                  ? isDarkMode
                    ? 'bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 text-white border border-purple-500/30'
                    : 'bg-gradient-to-r from-cyan-50 via-purple-50 to-pink-50 text-purple-700 border border-purple-200'
                  : isDarkMode
                    ? 'text-gray-300 hover:bg-white/5 hover:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className={isActive(item.path) 
                ? 'text-purple-400' 
                : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
              {isActive(item.path) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400"></div>
              )}
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className={`p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 mb-3 rounded-xl transition-all duration-200 ${
              isDarkMode 
                ? 'bg-white/5 text-gray-300 hover:bg-white/10' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isDarkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            <span className="text-sm">{isDarkMode ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>

          {/* User Info */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${
            isDarkMode ? 'bg-white/5' : 'bg-gray-50'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
              isDarkMode 
                ? 'bg-gradient-to-br from-cyan-500 to-purple-500' 
                : 'bg-gradient-to-br from-cyan-600 to-purple-600'
            }`}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {user?.name}
              </p>
              <p className={`text-xs capitalize ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {user?.role}
              </p>
            </div>
            <button
              onClick={logout}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' 
                  : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
              }`}
              title="Sair"
            >
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-auto transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-900'
      }`}>
        {children}
      </main>

      {/* Backup Modal */}
      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onBackupComplete={handleBackupComplete}
      />
    </div>
  );
}
