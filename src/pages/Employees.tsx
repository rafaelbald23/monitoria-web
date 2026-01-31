import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, EditIcon, TrashIcon, AlertIcon, UsersIcon } from '../components/Icons';

interface Employee {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface UserInfo {
  maxEmployees: number;
  currentEmployees: number;
}

export default function Employees() {
  const { user: currentUser } = useAuth();
  const { isDarkMode } = useTheme();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', name: '', email: '', role: 'seller' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [empRes, infoRes] = await Promise.all([api.getUsers(), api.getUserInfo()]);
      setEmployees((empRes as Employee[]).filter((u: Employee) => u.id !== currentUser?.id));
      setUserInfo(infoRes as UserInfo);
    } catch (err: any) {
      showMsg('error', err.message || 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const canAdd = () => userInfo ? userInfo.currentEmployees < userInfo.maxEmployees : false;

  const resetForm = () => setFormData({ username: '', password: '', name: '', email: '', role: 'seller' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.updateUser(editingEmployee.id, formData);
        showMsg('success', 'Funcionário atualizado!');
      } else {
        await api.createUser(formData);
        showMsg('success', 'Funcionário criado!');
      }
      setShowModal(false);
      setEditingEmployee(null);
      resetForm();
      loadData();
    } catch (err: any) {
      showMsg('error', err.message || 'Erro ao salvar');
    }
  };

  const handleEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({ username: emp.username, password: '', name: emp.name, email: emp.email, role: emp.role });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este funcionário?')) return;
    try {
      await api.deleteUser(id);
      showMsg('success', 'Funcionário excluído!');
      loadData();
    } catch (err: any) {
      showMsg('error', err.message || 'Erro ao excluir');
    }
  };

  const handleToggle = async (emp: Employee) => {
    try {
      await api.updateUser(emp.id, { isActive: !emp.isActive });
      showMsg('success', emp.isActive ? 'Funcionário desativado!' : 'Funcionário ativado!');
      loadData();
    } catch (err: any) {
      showMsg('error', err.message || 'Erro ao alterar status');
    }
  };

  const roleLabel = (r: string) => {
    const labels: Record<string, string> = { admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', viewer: 'Visualizador' };
    return labels[r] || r;
  };

  const roleColor = (r: string) => {
    const colors: Record<string, string> = {
      admin: isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700',
      manager: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700',
      seller: isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700',
      viewer: isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700'
    };
    return colors[r] || '';
  };

  const inputCls = "w-full rounded-xl px-4 py-3 border outline-none " + (isDarkMode ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-400 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500');
  const selectCls = "w-full rounded-xl px-4 py-3 border outline-none " + (isDarkMode ? 'bg-slate-700/50 border-slate-600 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500');

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={"text-2xl font-bold " + (isDarkMode ? 'text-white' : 'text-gray-900')}>Funcionários</h1>
            <p className={"text-sm " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>Gerencie os funcionários da sua empresa</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} disabled={loading} className={"flex items-center gap-2 px-4 py-2 rounded-xl " + (isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
              <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button onClick={() => { if (!canAdd()) { showMsg('error', 'Limite de funcionários atingido (' + userInfo?.maxEmployees + ')'); return; } setEditingEmployee(null); resetForm(); setShowModal(true); }} className={"flex items-center gap-2 px-4 py-2 rounded-xl " + (canAdd() ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed')}>
              <PlusIcon size={18} /> Novo Funcionário
            </button>
          </div>
        </div>

        {userInfo && (
          <div className={"mb-6 p-4 rounded-xl flex items-center justify-between " + (isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100')}>
                <UsersIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              </div>
              <div>
                <p className={"text-sm font-medium " + (isDarkMode ? 'text-white' : 'text-gray-900')}>Funcionários cadastrados</p>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Limite do seu plano</p>
              </div>
            </div>
            <div className="text-right">
              <p className={"text-2xl font-bold " + (userInfo.currentEmployees >= userInfo.maxEmployees ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900')}>{userInfo.currentEmployees} / {userInfo.maxEmployees}</p>
              {userInfo.currentEmployees >= userInfo.maxEmployees && <p className="text-xs text-red-500">Limite atingido</p>}
            </div>
          </div>
        )}

        {message && (
          <div className={"mb-4 p-4 rounded-xl flex items-center gap-3 " + (message.type === 'success' ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') : (isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'))}>
            <AlertIcon size={20} /> {message.text}
          </div>
        )}

        {loading ? (
          <div className={"text-center py-8 " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" /> Carregando...
          </div>
        ) : employees.length === 0 ? (
          <div className={"text-center py-16 rounded-2xl border " + (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500')}>
            <UsersIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum funcionário cadastrado</p>
            <button onClick={() => { setEditingEmployee(null); resetForm(); setShowModal(true); }} className="text-cyan-500 hover:text-cyan-400 font-medium">Cadastrar primeiro funcionário</button>
          </div>
        ) : (
          <div className={"rounded-2xl border overflow-hidden " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <table className="min-w-full">
              <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                <tr>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-left " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Usuário</th>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-left " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Nome</th>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-left " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Email</th>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-left " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Cargo</th>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-left " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Status</th>
                  <th className={"px-6 py-3 text-xs font-medium uppercase text-right " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Ações</th>
                </tr>
              </thead>
              <tbody className={"divide-y " + (isDarkMode ? 'divide-white/10' : 'divide-gray-200')}>
                {employees.map((emp) => (
                  <tr key={emp.id} className={isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}>
                    <td className={"px-6 py-4 text-sm font-medium " + (isDarkMode ? 'text-white' : 'text-gray-900')}>{emp.username}</td>
                    <td className={"px-6 py-4 text-sm " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>{emp.name}</td>
                    <td className={"px-6 py-4 text-sm " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>{emp.email}</td>
                    <td className="px-6 py-4"><span className={"px-3 py-1 rounded-full text-xs font-medium " + roleColor(emp.role)}>{roleLabel(emp.role)}</span></td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggle(emp)} className={"px-3 py-1 rounded-full text-xs font-medium " + (emp.isActive ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') : (isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'))}>
                        {emp.isActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => handleEdit(emp)} className={"p-2 rounded-lg " + (isDarkMode ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-cyan-600 hover:bg-cyan-100')}><EditIcon size={18} /></button>
                      <button onClick={() => handleDelete(emp.id)} className={"p-2 rounded-lg " + (isDarkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100')}><TrashIcon size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={"rounded-2xl p-6 w-full max-w-md border " + (isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200')}>
              <h2 className={"text-xl font-bold mb-6 " + (isDarkMode ? 'text-white' : 'text-gray-900')}>{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={"block text-sm font-medium mb-2 " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>Usuário de Login *</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} className={inputCls} placeholder="Ex: joao.silva" required disabled={!!editingEmployee} />
                </div>
                <div>
                  <label className={"block text-sm font-medium mb-2 " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>{editingEmployee ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={inputCls} placeholder="Mínimo 6 caracteres" required={!editingEmployee} />
                </div>
                <div>
                  <label className={"block text-sm font-medium mb-2 " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>Nome Completo *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={inputCls} placeholder="Ex: João da Silva" required />
                </div>
                <div>
                  <label className={"block text-sm font-medium mb-2 " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} placeholder="joao@empresa.com" required />
                </div>
                <div>
                  <label className={"block text-sm font-medium mb-2 " + (isDarkMode ? 'text-gray-300' : 'text-gray-700')}>Cargo</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={selectCls}>
                    <option value="seller">Vendedor</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                    <option value="viewer">Visualizador</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); setEditingEmployee(null); }} className={"px-6 py-3 rounded-xl font-medium " + (isDarkMode ? 'bg-slate-700 text-gray-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>Cancelar</button>
                  <button type="submit" className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-medium hover:opacity-90">Salvar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
