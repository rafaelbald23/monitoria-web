import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import api from '../lib/api';
import { Logo } from '../components/Logo';
import {
  RefreshIcon, PlusIcon, UserIcon, DollarIcon, AlertIcon,
  CheckIcon, TrashIcon, EditIcon, LogoutIcon, SunIcon, MoonIcon
} from '../components/Icons';

interface Client {
  id: string;
  username: string;
  name: string;
  email: string;
  companyName: string;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionEnd: string;
  lastPaymentDate: string;
  lastLoginAt: string;
  createdAt: string;
}

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  expiringClients: number;
  recentLogins: any[];
}

export default function MasterPanel() {
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    username: '', password: '', name: '', email: '', companyName: '',
    subscriptionPlan: 'basic', subscriptionEnd: ''
  });

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const result = await api.checkMaster();
      if (!result.isMaster) {
        navigate('/dashboard');
        return;
      }
      loadData();
    } catch (error) {
      navigate('/login');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, clientsData] = await Promise.all([
        api.getMasterDashboard(),
        api.getClients(),
      ]);
      setStats(statsData);
      setClients(clientsData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await api.updateClient(editingClient.id, formData);
        showMessage('success', 'Cliente atualizado!');
      } else {
        await api.createClient(formData);
        showMessage('success', 'Cliente criado! Envie as credenciais.');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao salvar');
    }
  };

  const resetForm = () => {
    setEditingClient(null);
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 30);
    setFormData({
      username: '', password: '', name: '', email: '', companyName: '',
      subscriptionPlan: 'basic', subscriptionEnd: defaultEnd.toISOString().split('T')[0]
    });
  };

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspender acesso deste cliente?')) return;
    try {
      await api.suspendClient(id);
      showMessage('success', 'Cliente suspenso!');
      loadData();
    } catch (error) {
      showMessage('error', 'Erro ao suspender');
    }
  };

  const handleActivate = async (id: string) => {
    const days = prompt('Quantos dias adicionar?', '30');
    if (!days) return;
    try {
      await api.activateClient(id, parseInt(days));
      showMessage('success', 'Cliente reativado!');
      loadData();
    } catch (error) {
      showMessage('error', 'Erro ao reativar');
    }
  };

  const handlePayment = async (id: string) => {
    const days = prompt('Quantos dias adicionar?', '30');
    if (!days) return;
    try {
      await api.registerPayment(id, parseInt(days));
      showMessage('success', 'Pagamento registrado!');
      loadData();
    } catch (error) {
      showMessage('error', 'Erro ao registrar pagamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cliente permanentemente?')) return;
    try {
      await api.deleteClient(id);
      showMessage('success', 'Cliente excluído!');
      loadData();
    } catch (error) {
      showMessage('error', 'Erro ao excluir');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700';
    if (status === 'suspended') return isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700';
    return isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700';
  };

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('pt-BR') : '-';
  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-900' : 'bg-gray-100'}`}>
      {/* Header */}
      <header className={`p-4 border-b ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Painel Master</h1>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Gestão de Clientes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className={`p-2 rounded-lg ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}>
              {isDarkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
            </button>
            <button onClick={() => navigate('/dashboard')} className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Sistema</button>
            <button onClick={logout} className={`p-2 rounded-lg ${isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}><LogoutIcon size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {message && (
          <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
            <AlertIcon size={20} /> {message.text}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}><UserIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} /></div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Clientes</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.totalClients}</p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}><CheckIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} /></div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ativos</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{stats.activeClients}</p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}><AlertIcon size={20} className={isDarkMode ? 'text-red-400' : 'text-red-600'} /></div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Suspensos</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>{stats.suspendedClients}</p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}><AlertIcon size={20} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} /></div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vencendo</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>{stats.expiringClients}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mb-4">
          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Clientes</h2>
          <div className="flex gap-2">
            <button onClick={loadData} disabled={loading} className={`p-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}`}><RefreshIcon size={18} className={loading ? 'animate-spin' : ''} /></button>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-lg"><PlusIcon size={18} /> Novo Cliente</button>
          </div>
        </div>

        {/* Clients Table */}
        <div className={`rounded-xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Empresa</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Usuário</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vencimento</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Último Acesso</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                {clients.map((client) => (
                  <tr key={client.id} className={isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}>
                    <td className={`px-4 py-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      <div className="font-medium">{client.companyName || client.name}</div>
                      <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{client.email}</div>
                    </td>
                    <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{client.username}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.subscriptionStatus)}`}>{client.subscriptionStatus === 'active' ? 'Ativo' : 'Suspenso'}</span></td>
                    <td className={`px-4 py-3 text-sm ${isExpiringSoon(client.subscriptionEnd) ? 'text-yellow-500 font-medium' : isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{formatDate(client.subscriptionEnd)}</td>
                    <td className={`px-4 py-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(client.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handlePayment(client.id)} className={`p-1.5 rounded text-xs ${isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'}`} title="Registrar Pagamento"><DollarIcon size={16} /></button>
                        {client.subscriptionStatus === 'active' ? (
                          <button onClick={() => handleSuspend(client.id)} className={`p-1.5 rounded text-xs ${isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`} title="Suspender"><AlertIcon size={16} /></button>
                        ) : (
                          <button onClick={() => handleActivate(client.id)} className={`p-1.5 rounded text-xs ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`} title="Reativar"><CheckIcon size={16} /></button>
                        )}
                        <button onClick={() => { setEditingClient(client); setFormData({ ...formData, name: client.name, email: client.email, companyName: client.companyName || '', subscriptionPlan: client.subscriptionPlan, subscriptionEnd: client.subscriptionEnd?.split('T')[0] || '' }); setShowModal(true); }} className={`p-1.5 rounded ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-gray-600 hover:bg-gray-100'}`}><EditIcon size={16} /></button>
                        <button onClick={() => handleDelete(client.id)} className={`p-1.5 rounded ${isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}><TrashIcon size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {!editingClient && (
                <>
                  <input type="text" placeholder="Usuário de login" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} required />
                  <input type="password" placeholder="Senha" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} required />
                </>
              )}
              <input type="text" placeholder="Nome do responsável" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} required />
              <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} required />
              <input type="text" placeholder="Nome da empresa" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} />
              <div>
                <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Vencimento da assinatura</label>
                <input type="date" value={formData.subscriptionEnd} onChange={(e) => setFormData({ ...formData, subscriptionEnd: e.target.value })} className={`w-full rounded-lg px-3 py-2 border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300'}`} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
