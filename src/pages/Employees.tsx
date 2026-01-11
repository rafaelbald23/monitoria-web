import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, EditIcon, TrashIcon, AlertIcon, UsersIcon } from '../components/Icons';

interface Employee { id: string; username: string; name: string; email: string; role: string; isActive: boolean; createdAt: string; }
interface UserInfo { maxEmployees: number; currentEmployees: number; }

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesResult, userInfoResult] = await Promise.all([api.getUsers(), api.getUserInfo()]);
      setEmployees((employeesResult as Employee[]).filter((u: Employee) => u.id !== currentUser?.id));
      setUserInfo(userInfoResult as UserInfo);
    } catch (error: any) { showMessage('error', error.message || 'Erro ao carregar'); }
    finally { setLoading(false); }
  };

  const showMessage = (type: 'success' | 'error', text: string) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 4000); };
  const canAddEmployee = () => userInfo ? userInfo.currentEmployees < userInfo.maxEmployees : false;
  const resetForm = () => setFormData({ username: '', password: '', name: '', email: '', role: 'seller' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) { await api.updateUser(editingEmployee.id, formData); showMessage('success', 'Atualizado!'); }
      else { await api.createUser(formData); showMessage('success', 'Criado!'); }
      setShowModal(false); setEditingEmployee(null); resetForm(); loadData();
    } catch (error: any) { showMessage('error', error.message || 'Erro'); }
  };

  const handleEdit = (e: Employee) => { setEditingEmployee(e); setFormData({ username: e.username, password: '', name: e.name, email: e.email, role: e.role }); setShowModal(true); };
  const handleDelete = async (id: string) => { if (!confirm('Excluir?')) return; try { await api.deleteUser(id); showMessage('success', 'Excluído!'); loadData(); } catch (error: any) { showMessage('error', error.message); } };
  const handleToggleStatus = async (e: Employee) => { try { await api.updateUser(e.id, { isActive: !e.isActive }); showMessage('success', e.isActive ? 'Desativado!' : 'Ativado!'); loadData(); } catch (error: any) { showMessage('error', error.message); } };
  const getRoleLabel = (r: string) => ({ admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', viewer: 'Visualizador' }[r] || r);
  const getRoleColor = (r: string) => ({ admin: isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700', manager: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700', seller: isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', viewer: isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700' }[r] || '');

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className={isDarkMode ? 'text-2xl font-bold text-white' : 'text-2xl font-bold text-gray-900'}>Funcionários</h1></div>
          <div className="flex gap-3">
            <button onClick={loadData} disabled={loading} className={isDarkMode ? 'flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-gray-300' : 'flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700'}><RefreshIcon size={18} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
            <button onClick={() => { if (!canAddEmployee()) { showMessage('error', 'Limite atingido'); return; } resetForm(); setShowModal(true); }} className={canAddEmployee() ? 'flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-200 text-gray-400'}><PlusIcon size={18} /> Novo</button>
          </div>
        </div>
        {userInfo && <div className={isDarkMode ? 'mb-6 p-4 rounded-xl flex items-center justify-between bg-white/5 border border-white/10' : 'mb-6 p-4 rounded-xl flex items-center justify-between bg-gray-50 border border-gray-200'}><div className="flex items-center gap-3"><UsersIcon size={20} /><span>Funcionários</span></div><span className="text-xl font-bold">{userInfo.currentEmployees} / {userInfo.maxEmployees}</span></div>}
        {message && <div className={message.type === 'success' ? 'mb-4 p-4 rounded-xl bg-green-100 text-green-700' : 'mb-4 p-4 rounded-xl bg-red-100 text-red-700'}><AlertIcon size={20} /> {message.text}</div>}
        {loading ? <div className="text-center py-8"><RefreshIcon size={24} className="animate-spin mx-auto" /></div> : employees.length === 0 ? <div className="text-center py-16">Nenhum funcionário</div> : (
          <table className="min-w-full"><thead><tr><th className="px-6 py-3 text-left">Usuário</th><th className="px-6 py-3 text-left">Nome</th><th className="px-6 py-3 text-left">Email</th><th className="px-6 py-3 text-left">Cargo</th><th className="px-6 py-3 text-left">Status</th><th className="px-6 py-3 text-right">Ações</th></tr></thead>
          <tbody>{employees.map((e) => <tr key={e.id}><td className="px-6 py-4">{e.username}</td><td className="px-6 py-4">{e.name}</td><td className="px-6 py-4">{e.email}</td><td className="px-6 py-4"><span className={getRoleColor(e.role)}>{getRoleLabel(e.role)}</span></td><td className="px-6 py-4"><button onClick={() => handleToggleStatus(e)}>{e.isActive ? 'Ativo' : 'Inativo'}</button></td><td className="px-6 py-4 text-right"><button onClick={() => handleEdit(e)}><EditIcon size={18} /></button><button onClick={() => handleDelete(e.id)}><TrashIcon size={18} /></button></td></tr>)}</tbody></table>
        )}
        {showModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className={isDarkMode ? 'rounded-2xl p-6 w-full max-w-md bg-slate-800' : 'rounded-2xl p-6 w-full max-w-md bg-white'}><h2 className="text-xl font-bold mb-6">{editingEmployee ? 'Editar' : 'Novo'} Funcionário</h2><form onSubmit={handleSubmit} className="space-y-4"><input type="text" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} placeholder="Usuário" required disabled={!!editingEmployee} className="w-full rounded-xl px-4 py-3 border" /><input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder="Senha" required={!editingEmployee} className="w-full rounded-xl px-4 py-3 border" /><input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="Nome" required className="w-full rounded-xl px-4 py-3 border" /><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="Email" required className="w-full rounded-xl px-4 py-3 border" /><select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full rounded-xl px-4 py-3 border"><option value="seller">Vendedor</option><option value="manager">Gerente</option><option value="admin">Admin</option></select><div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl bg-gray-100">Cancelar</button><button type="submit" className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white">Salvar</button></div></form></div></div>}
      </div>
    </Layout>
  );
}
