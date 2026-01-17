import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { LockIcon, EyeIcon, EyeOffIcon, CheckIcon, UsersIcon, CalendarIcon, DatabaseIcon, DownloadIcon, UploadIcon, ShieldIcon, BuildingIcon, FileTextIcon, InfoIcon, KeyIcon, StarIcon } from '../components/Icons';

interface UserInfo {
  id: string;
  username: string;
  name: string;
  email: string;
  companyName?: string;
  maxEmployees: number;
  currentEmployees: number;
  subscriptionPlan?: string;
  subscriptionEnd?: string;
}

export default function Settings() {
  const { isDarkMode } = useTheme();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const info = await api.getUserInfo() as UserInfo;
      setUserInfo(info);
    } catch (error) {
      console.error('Erro ao carregar informações:', error);
    }
  };

  const getPlanLabel = (plan?: string) => {
    const plans: Record<string, string> = {
      basic: 'Básico',
      pro: 'Profissional',
      enterprise: 'Empresarial'
    };
    return plans[plan || 'basic'] || plan || 'Básico';
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'A nova senha deve ter no mínimo 8 caracteres' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    setLoading(true);

    try {
      const result = await api.changePassword(currentPassword, newPassword);
      if (result.success) {
        setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: result.error || 'Erro ao alterar senha' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao alterar senha' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setBackupMessage(null);
    setBackupLoading(true);

    try {
      const result: any = await api.createBackup();
      if (result.success) {
        // Fazer download do backup
        const dataStr = JSON.stringify(result.backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setBackupMessage({ 
          type: 'success', 
          text: `Backup criado com sucesso! ${result.backup.summary.products} produtos, ${result.backup.summary.customers} clientes salvos.` 
        });
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Erro ao criar backup' });
      }
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Erro ao criar backup' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBackupMessage(null);
    setRestoreLoading(true);

    try {
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      if (!backupData.version || !backupData.userData) {
        throw new Error('Arquivo de backup inválido');
      }

      const confirmRestore = window.confirm(
        `Deseja restaurar o backup de ${backupData.userData.name}?\n\n` +
        `Produtos: ${backupData.summary?.products || 0}\n` +
        `Clientes: ${backupData.summary?.customers || 0}\n` +
        `Vendas: ${backupData.summary?.sales || 0}\n\n` +
        `ATENÇÃO: Esta operação não pode ser desfeita!`
      );

      if (!confirmRestore) {
        setRestoreLoading(false);
        return;
      }

      const replaceExisting = window.confirm(
        'Deseja substituir dados existentes?\n\n' +
        'SIM = Substitui produtos/clientes existentes\n' +
        'NÃO = Mantém dados existentes, adiciona apenas novos'
      );

      const result: any = await api.restoreBackup(backupData, replaceExisting);
      if (result.success) {
        setBackupMessage({ type: 'success', text: result.message });
        // Recarregar a página após 2 segundos para mostrar os dados restaurados
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setBackupMessage({ type: 'error', text: result.error || 'Erro ao restaurar backup' });
      }
    } catch (error: any) {
      setBackupMessage({ type: 'error', text: error.message || 'Erro ao processar arquivo de backup' });
    } finally {
      setRestoreLoading(false);
      // Limpar o input
      event.target.value = '';
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <ShieldIcon size={28} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
            </div>
            <div>
              <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Configurações</h1>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Gerencie sua conta, segurança e dados
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Coluna da Esquerda - Informações da Conta */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Informações do Usuário */}
            {userInfo && (
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl ${isDarkMode ? 'bg-gradient-to-br from-cyan-500 to-purple-500' : 'bg-gradient-to-br from-cyan-600 to-purple-600'}`}>
                    {userInfo.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {userInfo.name}
                    </h2>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      @{userInfo.username}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
                    <div className="flex items-center gap-3">
                      <UsersIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
                      <div>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Funcionários
                        </p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Limite do seu plano
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        userInfo.currentEmployees >= userInfo.maxEmployees 
                          ? 'text-red-500' 
                          : isDarkMode ? 'text-cyan-400' : 'text-cyan-600'
                      }`}>
                        {userInfo.currentEmployees} / {userInfo.maxEmployees}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                    <div className="flex items-center gap-3">
                      <CalendarIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                      <div>
                        <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          Plano: {getPlanLabel(userInfo.subscriptionPlan)}
                        </p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Válido até: {formatDate(userInfo.subscriptionEnd)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {userInfo.companyName && (
                    <div className="py-3 px-4 rounded-xl bg-gradient-to-r from-green-500/10 to-blue-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <BuildingIcon size={16} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
                        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Empresa</p>
                      </div>
                      <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{userInfo.companyName}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Backup e Restauração */}
            <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
                  <DatabaseIcon size={24} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
                </div>
                <div>
                  <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Backup e Restauração</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Proteja seus dados importantes</p>
                </div>
              </div>

              {backupMessage && (
                <div className={`mb-4 p-4 rounded-xl border ${backupMessage.type === 'success' ? isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200' : isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <p className="text-sm font-medium">{backupMessage.text}</p>
                </div>
              )}

              <div className="space-y-4">
                {/* Criar Backup */}
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Criar Backup</h3>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Baixe todos os seus dados em um arquivo seguro
                  </p>
                  <button
                    onClick={handleCreateBackup}
                    disabled={backupLoading}
                    className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {backupLoading ? (
                      'Criando...'
                    ) : (
                      <>
                        <DownloadIcon size={16} />
                        Baixar Backup
                      </>
                    )}
                  </button>
                </div>

                {/* Restaurar Backup */}
                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <h3 className={`font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Restaurar Backup</h3>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Carregue um arquivo de backup para restaurar
                  </p>
                  <label className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2">
                    {restoreLoading ? (
                      'Restaurando...'
                    ) : (
                      <>
                        <UploadIcon size={16} />
                        Carregar Backup
                      </>
                    )}
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleRestoreBackup}
                      disabled={restoreLoading}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-start gap-2">
                    <InfoIcon size={16} className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'} />
                    <p className={`text-sm ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>
                      <strong>Importante:</strong> O backup inclui todos os seus dados exceto senhas e tokens de acesso. 
                      Após restaurar um backup, você precisará reconectar suas contas do Bling.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna da Direita - Alterar Senha */}
          <div className="lg:col-span-2">
            <div className={`rounded-2xl p-8 border ${isDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
                  <LockIcon size={32} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
                </div>
                <div>
                  <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Alterar Senha</h2>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Mantenha sua conta segura com uma senha forte</p>
                </div>
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-xl border ${message.type === 'success' ? isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200' : isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="flex items-center gap-2">
                      <KeyIcon size={16} />
                      Senha Atual
                    </div>
                  </label>
                  <div className="relative">
                    <input 
                      type={showCurrentPassword ? 'text' : 'password'} 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      className={`w-full rounded-xl px-4 py-3 pr-12 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                      placeholder="Digite sua senha atual"
                      disabled={loading} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)} 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} 
                      disabled={loading}
                    >
                      {showCurrentPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="flex items-center gap-2">
                      <StarIcon size={16} />
                      Nova Senha
                    </div>
                  </label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? 'text' : 'password'} 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      className={`w-full rounded-xl px-4 py-3 pr-12 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                      placeholder="Digite sua nova senha (mín. 8 caracteres)"
                      disabled={loading} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowNewPassword(!showNewPassword)} 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} 
                      disabled={loading}
                    >
                      {showNewPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    <div className="flex items-center gap-2">
                      <CheckIcon size={16} />
                      Confirmar Nova Senha
                    </div>
                  </label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      className={`w-full rounded-xl px-4 py-3 pr-12 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} 
                      placeholder="Confirme sua nova senha"
                      disabled={loading} 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`} 
                      disabled={loading}
                    >
                      {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {loading ? (
                      'Alterando senha...'
                    ) : (
                      <>
                        <CheckIcon size={20} />
                        Alterar Senha
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Dicas de Segurança */}
              <div className={`mt-8 p-6 rounded-xl border ${isDarkMode ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                <h3 className={`font-semibold mb-3 flex items-center gap-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                  <ShieldIcon size={20} />
                  Dicas de Segurança
                </h3>
                <ul className={`text-sm space-y-2 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                  <li>• Use pelo menos 8 caracteres</li>
                  <li>• Combine letras maiúsculas e minúsculas</li>
                  <li>• Inclua números e símbolos</li>
                  <li>• Evite informações pessoais óbvias</li>
                  <li>• Não reutilize senhas de outras contas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}