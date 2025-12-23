import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import Layout from '../components/Layout';
import { CurrencyInput } from '../components/CurrencyInput';
import { ExportButton } from '../components/ExportButton';
import { exportToCSV, exportToPDF, generateTableHTML } from '../utils/export';
import {
  RefreshIcon, PlusIcon, UserIcon, DollarIcon, AlertIcon,
  CheckIcon, TrashIcon, LinkIcon
} from '../components/Icons';

interface Client {
  id: string;
  username: string;
  name: string;
  email: string;
  phone?: string;
  companyName: string;
  isActive: boolean;
  subscriptionStatus: string;
  subscriptionPlan: string;
  subscriptionEnd: string;
  lastPaymentDate: string;
  lastLoginAt: string;
  monthlyValue?: number;
  notes?: string;
  createdAt: string;
}

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  expiringClients: number;
  monthlyRevenue: number;
}

type FilterType = 'all' | 'active' | 'suspended' | 'expiring';

export default function MasterPanel() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    username: '', password: '', name: '', email: '', phone: '', companyName: '',
    subscriptionPlan: 'basic', subscriptionEnd: '', monthlyValue: '', notes: ''
  });
  const [paymentData, setPaymentData] = useState({ amount: '', daysToAdd: '30', method: 'pix', notes: '' });

  useEffect(() => { checkAccess(); }, []);

  const checkAccess = async () => {
    try {
      const result = await api.checkMaster() as { isMaster: boolean };
      if (!result.isMaster) { navigate('/dashboard'); return; }
      loadData();
    } catch { navigate('/login'); }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, clientsData] = await Promise.all([api.getMasterDashboard(), api.getClients()]);
      setStats(statsData as DashboardStats);
      setClients(clientsData as Client[]);
    } catch (error) { console.error('Erro:', error); }
    finally { setLoading(false); }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData, monthlyValue: formData.monthlyValue ? parseFloat(formData.monthlyValue) : null };
      if (editingClient) {
        await api.updateClient(editingClient.id, data);
        showMessage('success', 'Cliente atualizado!');
      } else {
        await api.createClient(data);
        showMessage('success', 'Cliente criado! Credenciais prontas para enviar.');
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) { showMessage('error', error.message || 'Erro ao salvar'); }
  };

  const resetForm = () => {
    setEditingClient(null);
    const defaultEnd = new Date(); defaultEnd.setDate(defaultEnd.getDate() + 30);
    setFormData({
      username: '', password: '', name: '', email: '', phone: '', companyName: '',
      subscriptionPlan: 'basic', subscriptionEnd: defaultEnd.toISOString().split('T')[0],
      monthlyValue: '', notes: ''
    });
  };

  const handleSuspend = async (id: string) => {
    if (!confirm('Suspender acesso deste cliente? Ele não conseguirá mais entrar no sistema.')) return;
    try {
      await api.suspendClient(id);
      showMessage('success', 'Cliente suspenso!');
      loadData();
    } catch { showMessage('error', 'Erro ao suspender'); }
  };

  const handleActivate = async (id: string) => {
    const days = prompt('Quantos dias de acesso adicionar?', '30');
    if (!days) return;
    try {
      await api.activateClient(id, parseInt(days));
      showMessage('success', 'Cliente reativado!');
      loadData();
    } catch { showMessage('error', 'Erro ao reativar'); }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    try {
      await api.registerPayment(selectedClient.id, parseInt(paymentData.daysToAdd), {
        amount: parseFloat(paymentData.amount), method: paymentData.method, notes: paymentData.notes
      });
      showMessage('success', 'Pagamento registrado!');
      setShowPaymentModal(false);
      setPaymentData({ amount: '', daysToAdd: '30', method: 'pix', notes: '' });
      loadData();
    } catch { showMessage('error', 'Erro ao registrar pagamento'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ATENÇÃO: Excluir este cliente permanentemente? Todos os dados serão perdidos!')) return;
    try {
      await api.deleteClient(id);
      showMessage('success', 'Cliente excluído!');
      loadData();
    } catch { showMessage('error', 'Erro ao excluir'); }
  };

  const copyCredentials = (client: Client) => {
    const text = `Credenciais de Acesso - monitorIA\n\n` +
      `Usuário: ${client.username}\n` +
      `Acesso: https://monitoria-web-production.up.railway.app\n\n` +
      `Qualquer dúvida, estou à disposição!`;
    navigator.clipboard.writeText(text);
    showMessage('success', 'Credenciais copiadas!');
  };

  const getStatusColor = (status: string) => {
    if (status === 'active') return isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200';
    if (status === 'suspended') return isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200';
    return isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };

  const formatDate = (date: string) => date ? new Date(date).toLocaleDateString('pt-BR') : '-';
  const formatCurrency = (value: number | undefined) => value ? `R$ ${value.toFixed(2)}` : '-';
  const isExpiringSoon = (date: string) => {
    if (!date) return false;
    const diff = new Date(date).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  };
  const isExpired = (date: string) => date && new Date(date).getTime() < Date.now();

  const filteredClients = clients.filter(client => {
    const matchesSearch = search === '' || 
      client.name.toLowerCase().includes(search.toLowerCase()) ||
      client.companyName?.toLowerCase().includes(search.toLowerCase()) ||
      client.email.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'active') return client.subscriptionStatus === 'active';
    if (filter === 'suspended') return client.subscriptionStatus === 'suspended';
    if (filter === 'expiring') return isExpiringSoon(client.subscriptionEnd) || isExpired(client.subscriptionEnd);
    return true;
  });

  const cardClass = `p-5 rounded-2xl border ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`;
  const inputClass = `w-full rounded-xl px-4 py-3 border transition-colors ${isDarkMode ? 'bg-slate-700/50 border-white/10 text-white placeholder-gray-400 focus:border-purple-500' : 'bg-gray-50 border-gray-200 focus:border-purple-500'}`;
  const btnSecondary = `px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`;
  const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity';

  const clientColumns = [
    { key: 'companyName', label: 'Empresa' },
    { key: 'name', label: 'Responsável' },
    { key: 'username', label: 'Usuário' },
    { key: 'email', label: 'Email' },
    { key: 'subscriptionStatus', label: 'Status' },
    { key: 'subscriptionEnd', label: 'Vencimento' },
    { key: 'monthlyValue', label: 'Mensalidade' },
    { key: 'lastLoginAt', label: 'Último Acesso' },
  ];

  const handleExportCSV = () => {
    const dataToExport = filteredClients.map(client => ({
      ...client,
      subscriptionStatus: client.subscriptionStatus === 'active' ? 'Ativo' : 'Suspenso',
    }));
    exportToCSV(dataToExport, 'clientes', clientColumns);
  };

  const handleExportPDF = () => {
    const dataToExport = filteredClients.map(client => ({
      ...client,
      subscriptionStatus: client.subscriptionStatus === 'active' ? 'Ativo' : 'Suspenso',
    }));
    const tableHTML = generateTableHTML(dataToExport, clientColumns);
    exportToPDF('Relatório de Clientes', tableHTML);
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Painel Master
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Gerencie seus clientes e assinaturas
            </p>
          </div>
          <div className="flex gap-2">
            <ExportButton onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            <button onClick={() => { resetForm(); setShowModal(true); }} className={`${btnPrimary} flex items-center gap-2`}>
              <PlusIcon size={18} /> Novo Cliente
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.type === 'success' ? <CheckIcon size={20} /> : <AlertIcon size={20} />} {message.text}
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                  <UserIcon size={24} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
                </div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total</p>
                  <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{stats.totalClients}</p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
                  <CheckIcon size={24} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
                </div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ativos</p>
                  <p className={`text-2xl font-bold text-green-500`}>{stats.activeClients}</p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
                  <AlertIcon size={24} className={isDarkMode ? 'text-red-400' : 'text-red-600'} />
                </div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Suspensos</p>
                  <p className={`text-2xl font-bold text-red-500`}>{stats.suspendedClients}</p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
                  <AlertIcon size={24} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} />
                </div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Vencendo</p>
                  <p className={`text-2xl font-bold text-yellow-500`}>{stats.expiringClients}</p>
                </div>
              </div>
            </div>
            <div className={cardClass}>
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                  <DollarIcon size={24} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                </div>
                <div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Receita/mês</p>
                  <p className={`text-xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                    R$ {(stats.monthlyRevenue || 0).toFixed(0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className={`${cardClass} mb-6`}>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar por nome, empresa ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex gap-2">
              {(['all', 'active', 'suspended', 'expiring'] as FilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white'
                      : btnSecondary
                  }`}
                >
                  {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : f === 'suspended' ? 'Suspensos' : 'Vencendo'}
                </button>
              ))}
              <button onClick={loadData} disabled={loading} className={btnSecondary}>
                <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <div key={client.id} className={`${cardClass} hover:border-purple-500/50 transition-colors`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                    client.subscriptionStatus === 'active' 
                      ? 'bg-gradient-to-br from-cyan-500 to-purple-500' 
                      : 'bg-gray-500'
                  }`}>
                    {client.companyName?.charAt(0) || client.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {client.companyName || client.name}
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {client.name}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(client.subscriptionStatus)}`}>
                  {client.subscriptionStatus === 'active' ? 'Ativo' : 'Suspenso'}
                </span>
              </div>

              <div className={`space-y-2 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="flex justify-between">
                  <span>Usuário:</span>
                  <span className="font-mono">{client.username}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vencimento:</span>
                  <span className={`font-medium ${
                    isExpired(client.subscriptionEnd) ? 'text-red-500' :
                    isExpiringSoon(client.subscriptionEnd) ? 'text-yellow-500' : ''
                  }`}>
                    {formatDate(client.subscriptionEnd)}
                    {isExpired(client.subscriptionEnd) && ' (Vencido!)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Mensalidade:</span>
                  <span className="font-medium">{formatCurrency(client.monthlyValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Último acesso:</span>
                  <span>{formatDate(client.lastLoginAt)}</span>
                </div>
              </div>

              {client.notes && (
                <div className={`mt-3 p-2 rounded-lg text-xs ${isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                  {client.notes}
                </div>
              )}

              <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                <button
                  onClick={() => { setSelectedClient(client); setPaymentData({ ...paymentData, amount: client.monthlyValue?.toString() || '' }); setShowPaymentModal(true); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isDarkMode ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                >
                  <DollarIcon size={16} /> Pagamento
                </button>
                <button
                  onClick={() => copyCredentials(client)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'}`}
                >
                  <LinkIcon size={16} /> Copiar
                </button>
              </div>

              <div className="flex gap-1 mt-2">
                {client.subscriptionStatus === 'active' ? (
                  <button onClick={() => handleSuspend(client.id)} className={`flex-1 py-1.5 rounded-lg text-xs ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                    Suspender
                  </button>
                ) : (
                  <button onClick={() => handleActivate(client.id)} className={`flex-1 py-1.5 rounded-lg text-xs ${isDarkMode ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'}`}>
                    Reativar
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingClient(client);
                    setFormData({
                      username: client.username, password: '', name: client.name, email: client.email,
                      phone: client.phone || '', companyName: client.companyName || '',
                      subscriptionPlan: client.subscriptionPlan, subscriptionEnd: client.subscriptionEnd?.split('T')[0] || '',
                      monthlyValue: client.monthlyValue?.toString() || '', notes: client.notes || ''
                    });
                    setShowModal(true);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Editar
                </button>
                <button onClick={() => handleDelete(client.id)} className={`py-1.5 px-3 rounded-lg text-xs ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredClients.length === 0 && (
          <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            {search || filter !== 'all' ? 'Nenhum cliente encontrado com esses filtros.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        )}

        {/* Modal Novo/Editar Cliente */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl p-6 w-full max-w-lg border max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingClient && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Usuário de login *</label>
                      <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={inputClass} required />
                    </div>
                    <div>
                      <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Senha *</label>
                      <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={inputClass} required />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nome do responsável *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputClass} required />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nome da empresa</label>
                    <input type="text" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Email *</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputClass} required />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>WhatsApp</label>
                    <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className={inputClass} placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Valor mensal</label>
                    <CurrencyInput value={formData.monthlyValue} onChange={(val) => setFormData({ ...formData, monthlyValue: val })} className={inputClass} placeholder="R$ 0,00" />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Vencimento</label>
                    <input type="date" value={formData.subscriptionEnd} onChange={(e) => setFormData({ ...formData, subscriptionEnd: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Observações</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={`${inputClass} resize-none`} rows={2} placeholder="Anotações sobre o cliente..." />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className={btnSecondary}>Cancelar</button>
                  <button type="submit" className={btnPrimary}>Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Registrar Pagamento */}
        {showPaymentModal && selectedClient && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Registrar Pagamento
              </h2>
              <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Cliente: <strong>{selectedClient.companyName || selectedClient.name}</strong>
              </p>
              <form onSubmit={handlePayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Valor</label>
                    <CurrencyInput value={paymentData.amount} onChange={(val) => setPaymentData({ ...paymentData, amount: val })} className={inputClass} placeholder="R$ 0,00" />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Dias a adicionar</label>
                    <input type="number" value={paymentData.daysToAdd} onChange={(e) => setPaymentData({ ...paymentData, daysToAdd: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Forma de pagamento</label>
                  <select value={paymentData.method} onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })} className={inputClass}>
                    <option value="pix">PIX</option>
                    <option value="boleto">Boleto</option>
                    <option value="cartao">Cartão</option>
                    <option value="transferencia">Transferência</option>
                    <option value="dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Observação</label>
                  <input type="text" value={paymentData.notes} onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })} className={inputClass} placeholder="Ex: Pagamento referente a dezembro" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowPaymentModal(false)} className={btnSecondary}>Cancelar</button>
                  <button type="submit" className={btnPrimary}>Confirmar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
