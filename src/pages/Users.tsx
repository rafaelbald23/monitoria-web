import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, EditIcon, TrashIcon, UserIcon, AlertIcon } from '../components/Icons';

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    username: '', password: '', name: '', email: '', role: 'seller'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await api.getUsers();
      setUsers(result);
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao carregar usuários');
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
      if (editingUser) {
        await api.updateUser(editingUser.id, formData);
        showMessage('success', 'Usuário atualizado!');
      } else {
        await api.createUser(formData);
        showMessage('success', 'Usuário criado! Envie as credenciais para seu cliente.');
      }
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      loadUsers();
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao salvar usuário');
    }
  };

  const resetForm = () => {
    setFormData({ username: '', password: '', name: '', email: '', role: 'seller' });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({ username: user.username, password: '', name: user.name, email: user.email, role: user.role });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await api.deleteUser(id);
      showMessage('success', 'Usuário excluído!');
      loadUsers();
    } catch (error: any) {
      showMessage('error', error.message || 'Erro ao excluir');
    }
  };

  const getRoleLabel = (role: string) => {
    const roles: Record<string, string> = {
      admin: 'Administrador', manager: 'Gerente', seller: 'Vendedor', viewer: 'Visualizador'
    };
    return roles[role] || role;
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
      manager: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
      seller: isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
      viewer: isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700',
    };
    return colors[role] || colors.viewer;
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Usuários</h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gerencie os usuários do sistema</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadUsers} disabled={loading} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { setEditingUser(null); resetForm(); setShowModal(true); }} className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-xl hover:opacity-90">
              <PlusIcon size={18} /> Novo Usuário
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
            <AlertIcon size={20} /> {message.text}
          </div>
        )}

        {loading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" /> Carregando...
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <table className="min-w-full">
              <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Usuário</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nome</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Email</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Perfil</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ações</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                {users.map((user) => (
                  <tr key={user.id} className={isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}>
                    <td className={`px-6 py-4 text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.username}</td>
                    <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{user.name}</td>
                    <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{user.email}</td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${user.isActive ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>{user.isActive ? 'Ativo' : 'Inativo'}</span></td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(user)} className={`p-2 rounded-lg ${isDarkMode ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-cyan-600 hover:bg-cyan-100'}`}><EditIcon size={18} /></button>
                        {user.id !== currentUser?.id && <button onClick={() => handleDelete(user.id)} className={`p-2 rounded-lg ${isDarkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100'}`}><TrashIcon size={18} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Usuário *</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`} required disabled={!!editingUser} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`} required={!editingUser} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nome Completo *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`} required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`} required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Perfil</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}>
                    <option value="seller">Vendedor</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className={`px-6 py-3 rounded-xl ${isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>Cancelar</button>
                  <button type="submit" className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
