import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, LinkIcon, FileTextIcon } from '../components/Icons';

interface Account {
  id: string;
  name: string;
  clientId?: string;
  clientSecret?: string;
  isActive: boolean;
  lastSync?: string;
  syncStatus?: string;
}

export default function Accounts() {
  const { isDarkMode } = useTheme();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({ name: '', clientId: '', clientSecret: '' });

  useEffect(() => {
    loadAccounts();

    // Listen for OAuth success
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BLING_OAUTH_SUCCESS') {
        loadAccounts();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const result = await api.getAccounts();
      setAccounts(result as Account[]);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await api.updateAccount(editingAccount.id, formData);
      } else {
        await api.createAccount(formData);
      }
      setShowModal(false);
      setEditingAccount(null);
      setFormData({ name: '', clientId: '', clientSecret: '' });
      loadAccounts();
    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      alert('Erro ao salvar conta');
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({ name: account.name, clientId: account.clientId || '', clientSecret: '' });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;
    try {
      await api.deleteAccount(id);
      loadAccounts();
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      alert('Erro ao excluir conta');
    }
  };

  const handleSync = async (id: string) => {
    try {
      const result = await api.syncAccount(id);
      loadAccounts();
      if (result.success) {
        alert(`Sincronização concluída!\n\n${result.imported} produtos novos importados\n${result.updated || 0} produtos atualizados\n${result.total} produtos no total`);
      } else {
        alert('Erro: ' + (result.error || 'Erro ao sincronizar'));
      }
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      alert('Erro ao sincronizar');
    }
  };

  const handleConnectBling = async (id: string) => {
    try {
      const result = await api.startBlingOAuth(id);
      if (result.success && result.authUrl) {
        window.open(result.authUrl, '_blank', 'width=600,height=700');
      } else {
        alert(result.error || 'Erro ao conectar');
      }
    } catch (error) {
      console.error('Erro ao conectar:', error);
      alert('Erro ao conectar com Bling');
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Contas Bling</h1>
          <button onClick={() => { setEditingAccount(null); setFormData({ name: '', clientId: '', clientSecret: '' }); setShowModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
            <PlusIcon size={18} />
            Nova Conta
          </button>
        </div>

        {loading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : accounts.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
            <LinkIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-2">Nenhuma conta Bling conectada</p>
            <p className="text-sm">Clique em "Nova Conta" para adicionar</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {accounts.map((account) => (
              <div key={account.id} className={`rounded-2xl p-6 border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 shadow-sm hover:shadow-md'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${account.syncStatus === 'connected' ? 'bg-gradient-to-r from-cyan-500 to-purple-500' : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <LinkIcon size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{account.name}</h3>
                      <p className={`text-sm flex items-center gap-1 ${account.syncStatus === 'connected' ? isDarkMode ? 'text-green-400' : 'text-green-600' : isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                        {account.syncStatus === 'connected' ? 'Conectado ao Bling' : 'Não conectado - Clique em "Conectar Bling"'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${account.syncStatus === 'connected' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                      {account.syncStatus === 'connected' ? 'Conectado' : 'Pendente'}
                    </span>
                  </div>
                </div>
                <div className={`flex flex-wrap gap-2 mt-4 pt-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
                  <button onClick={() => handleConnectBling(account.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>
                    <LinkIcon size={16} />
                    Conectar Bling
                  </button>
                  <button onClick={() => handleSync(account.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'}`}>
                    <RefreshIcon size={16} />
                    Sincronizar
                  </button>
                  <button onClick={() => handleEdit(account)} className={`px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Editar</button>
                  <button onClick={() => handleDelete(account.id)} className={`px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`rounded-2xl p-6 w-full max-w-lg border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{editingAccount ? 'Editar Conta' : 'Nova Conta Bling'}</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nome da Conta</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full rounded-xl px-3 py-2 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="Ex: Minha Loja" required />
                </div>
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Client ID</label>
                  <input type="text" value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })} className={`w-full rounded-xl px-3 py-2 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="Cole o Client ID do seu aplicativo Bling" />
                </div>
                <div className="mb-4">
                  <label className={`block text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Client Secret</label>
                  <input type="password" value={formData.clientSecret} onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })} className={`w-full rounded-xl px-3 py-2 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="Cole o Client Secret do seu aplicativo Bling" />
                </div>
                <div className={`text-xs p-3 rounded-lg mb-4 ${isDarkMode ? 'bg-white/5' : 'bg-blue-50'}`}>
                  <p className={`font-medium mb-2 flex items-center gap-2 ${isDarkMode ? 'text-cyan-400' : 'text-blue-700'}`}>
                    <FileTextIcon size={16} />
                    Como obter as credenciais:
                  </p>
                  <ol className={`list-decimal list-inside space-y-1 ${isDarkMode ? 'text-gray-400' : 'text-blue-600'}`}>
                    <li>Acesse sua conta no Bling</li>
                    <li>Vá em Configurações → Integrações → API</li>
                    <li>Crie um novo aplicativo</li>
                    <li>No campo "URL de Callback" coloque: <code className="bg-black/20 px-1 rounded">https://monitoria-web-production.up.railway.app/api/bling/callback</code></li>
                    <li>Copie o Client ID e Client Secret</li>
                  </ol>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowModal(false); setEditingAccount(null); }} className={`px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
