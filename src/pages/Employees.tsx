import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, EditIcon, TrashIcon, AlertIcon, UsersIcon } from '../components/Icons';

interface Employee { id: string; username: string; name: string; email: string; role: string; isActive: boolean; }
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
      const [empRes, infoRes] = await Promise.all([api.getUsers(), api.getUserInfo()]);
      setEmployees((empRes as Employee[]).filter((u: Employee) => u.id !== currentUser?.id));
      setUserInfo(infoRes as UserInfo);
    } catch (err: any) { showMsg('error', err.message || 'Erro'); } 
    finally { setLoading(false); }
  };

  const showMsg = (type: 'success' | 'error', text: string) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 4000); };
  const canAdd = () => userInfo ? userInfo.currentEmployees < userInfo.maxEmployees : false;
  const resetForm = () => setFormData({ username: '', password: '', name: '', email: '', role: 'seller' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmployee) { await api.updateUser(editingEmployee.id, formData); showMsg('success', 'Atualizado!'); }
      else { await api.createUser(formData); showMsg('success', 'Criado!'); }
      setShowModal(false); setEditingEmployee(null); resetForm(); loadData();
    } catch (err: any) { showMsg('error', err.message || 'Erro'); }
  };

  const handleEdit = (e: Employee) => { setEditingEmployee(e); setFormData({ username: e.username, password: '', name: e.name, email: e.email, role: e.role }); setShowModal(true); };
  const handleDelete = async (id: string) => { if (!confirm('Excluir?')) return; try { await api.deleteUser(id); showMsg('success', 'Excluido!'); loadData(); } catch (err: any) { showMsg('error', err.message); } };
  const handleToggle = async (e: Employee) => { try { await api.updateUser(e.id, { isActive: !e.isActive }); showMsg('success', e.isActive ? 'Desativado!' : 'Ativado!'); loadData(); } catch (err: any) { showMsg('error', err.message); } };

  const roleLabel = (r: string) => ({ admin: 'Admin', manager: 'Gerente', seller: 'Vendedor', viewer: 'Visualizador' }[r] || r);
  const roleColor = (r: string) => ({ admin: isDarkMode ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700', manager: isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700', seller: isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700', viewer: isDarkMode ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-700' }[r] || '');

  const inputCls = isDarkMode ? 'w-full rounded-xl px-4 py-3 border outline-none bg-slate-700/50 border-slate-600 text-white placeholder-gray-400 focus:border-purple-500' : 'w-full rounded-xl px-4 py-3 border outline-none bg-white border-gray-300 text-gray-900 focus:border-purple-500';

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div><h1 className={	ext-2xl font-bold +String(isDarkMode ? 'text-white' : 'text-gray-900')}>Funcionarios</h1></div>
          <div className="flex gap-3">
            <button onClick={loadData} disabled={loading} className={lex items-center gap-2 px-4 py-2 rounded-xl +String(isDarkMode ? 'bg-white/5 text-gray-300' : 'bg-gray-100 text-gray-700')}><RefreshIcon size={18} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
            <button onClick={() => { if (!canAdd()) { showMsg('error', 'Limite atingido'); return; } setEditingEmployee(null); resetForm(); setShowModal(true); }} className={lex items-center gap-2 px-4 py-2 rounded-xl +String(canAdd() ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-gray-500/20 text-gray-500')}><PlusIcon size={18} /> Novo</button>
          </div>
        </div>
        {userInfo && <div className={mb-6 p-4 rounded-xl flex items-center justify-between +String(isDarkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200')}><div className="flex items-center gap-3"><div className={p-2 rounded-lg +String(isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100')}><UsersIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} /></div><div><p className={	ext-sm font-medium +String(isDarkMode ? 'text-white' : 'text-gray-900')}>Funcionarios</p></div></div><p className={	ext-2xl font-bold +String(userInfo.currentEmployees >= userInfo.maxEmployees ? 'text-red-500' : isDarkMode ? 'text-white' : 'text-gray-900')}>{userInfo.currentEmployees} / {userInfo.maxEmployees}</p></div>}
        {message && <div className={mb-4 p-4 rounded-xl flex items-center gap-3 +String(message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}><AlertIcon size={20} /> {message.text}</div>}
        {loading ? <div className="text-center py-8"><RefreshIcon size={24} className="animate-spin mx-auto" /></div> : employees.length === 0 ? <div className={	ext-center py-16 rounded-2xl border +String(isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200')}><p>Nenhum funcionario</p></div> : (
          <div className={ounded-2xl border overflow-hidden +String(isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200')}>
            <table className="min-w-full"><thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}><tr>{['Usuario','Nome','Email','Cargo','Status','Acoes'].map((h,i)=><th key={h} className={px-6 py-3 text-xs font-medium uppercase +String(i===5?'text-right':'text-left')+' '+String(isDarkMode?'text-gray-400':'text-gray-500')}>{h}</th>)}</tr></thead>
            <tbody className={divide-y +String(isDarkMode ? 'divide-white/10' : 'divide-gray-200')}>{employees.map(emp=><tr key={emp.id}><td className={px-6 py-4 text-sm +String(isDarkMode?'text-white':'text-gray-900')}>{emp.username}</td><td className={px-6 py-4 text-sm +String(isDarkMode?'text-gray-300':'text-gray-700')}>{emp.name}</td><td className={px-6 py-4 text-sm +String(isDarkMode?'text-gray-300':'text-gray-700')}>{emp.email}</td><td className="px-6 py-4"><span className={px-3 py-1 rounded-full text-xs font-medium +roleColor(emp.role)}>{roleLabel(emp.role)}</span></td><td className="px-6 py-4"><button onClick={()=>handleToggle(emp)} className={px-3 py-1 rounded-full text-xs +String(emp.isActive?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400')}>{emp.isActive?'Ativo':'Inativo'}</button></td><td className="px-6 py-4 text-right flex justify-end gap-2"><button onClick={()=>handleEdit(emp)} className="p-2 rounded-lg text-cyan-400"><EditIcon size={18}/></button><button onClick={()=>handleDelete(emp.id)} className="p-2 rounded-lg text-red-400"><TrashIcon size={18}/></button></td></tr>)}</tbody></table>
          </div>
        )}
        {showModal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className={ounded-2xl p-6 w-full max-w-md border +String(isDarkMode?'bg-slate-800 border-slate-700':'bg-white border-gray-200')}><h2 className={	ext-xl font-bold mb-6 +String(isDarkMode?'text-white':'text-gray-900')}>{editingEmployee?'Editar':'Novo'} Funcionario</h2><form onSubmit={handleSubmit} className="space-y-4"><div><label className={lock text-sm mb-2 +String(isDarkMode?'text-gray-300':'text-gray-700')}>Usuario</label><input type="text" value={formData.username} onChange={e=>setFormData({...formData,username:e.target.value})} className={inputCls} required disabled={!!editingEmployee}/></div><div><label className={lock text-sm mb-2 +String(isDarkMode?'text-gray-300':'text-gray-700')}>Senha</label><input type="password" value={formData.password} onChange={e=>setFormData({...formData,password:e.target.value})} className={inputCls} required={!editingEmployee}/></div><div><label className={lock text-sm mb-2 +String(isDarkMode?'text-gray-300':'text-gray-700')}>Nome</label><input type="text" value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})} className={inputCls} required/></div><div><label className={lock text-sm mb-2 +String(isDarkMode?'text-gray-300':'text-gray-700')}>Email</label><input type="email" value={formData.email} onChange={e=>setFormData({...formData,email:e.target.value})} className={inputCls} required/></div><div><label className={lock text-sm mb-2 +String(isDarkMode?'text-gray-300':'text-gray-700')}>Cargo</label><select value={formData.role} onChange={e=>setFormData({...formData,role:e.target.value})} className={inputCls}><option value="seller">Vendedor</option><option value="manager">Gerente</option><option value="admin">Admin</option></select></div><div className="flex justify-end gap-3 pt-4"><button type="button" onClick={()=>setShowModal(false)} className={px-6 py-3 rounded-xl +String(isDarkMode?'bg-slate-700 text-gray-300':'bg-gray-100 text-gray-700')}>Cancelar</button><button type="submit" className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl">Salvar</button></div></form></div></div>}
      </div>
    </Layout>
  );
}
