import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DatabaseIcon, DownloadIcon, XIcon, ClockIcon } from './Icons';
import api from '../lib/api';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackupComplete: () => void;
}

export default function BackupModal({ isOpen, onClose, onBackupComplete }: BackupModalProps) {
  const { isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCreateBackup = async () => {
    setMessage(null);
    setLoading(true);

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

        setMessage({ 
          type: 'success', 
          text: `Backup criado com sucesso! ${result.backup.summary.products} produtos, ${result.backup.summary.customers} clientes salvos.` 
        });

        // Atualizar data do último backup
        await api.updateBackupDate();
        
        setTimeout(() => {
          onBackupComplete();
          onClose();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: result.error || 'Erro ao criar backup' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao criar backup' });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipFor7Days = async () => {
    try {
      await api.skipBackupFor7Days();
      onClose();
    } catch (error) {
      console.error('Erro ao pular backup:', error);
      onClose();
    }
  };

  const handleDisableAutoBackup = async () => {
    try {
      await api.disableAutoBackup();
      onClose();
    } catch (error) {
      console.error('Erro ao desabilitar backup automático:', error);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`max-w-md w-full rounded-2xl p-6 ${isDarkMode ? 'bg-gray-800 border border-white/10' : 'bg-white border border-gray-200'} shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'}`}>
              <DatabaseIcon size={24} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
            </div>
            <div>
              <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Backup Recomendado
              </h2>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Proteja seus dados importantes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:bg-gray-100 ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'text-gray-500'}`}
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Recomendamos fazer backup dos seus dados regularmente para garantir que suas informações estejam sempre seguras.
          </p>
          
          <div className={`p-4 rounded-xl ${isDarkMode ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
              📦 O backup inclui:
            </p>
            <ul className={`text-xs mt-2 space-y-1 ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>
              <li>• Produtos e estoque</li>
              <li>• Clientes e vendas</li>
              <li>• Configurações das contas</li>
              <li>• Histórico de movimentações</li>
            </ul>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-xl ${message.type === 'success' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleCreateBackup}
            disabled={loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              'Criando backup...'
            ) : (
              <>
                <DownloadIcon size={18} />
                Fazer Backup Agora
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSkipFor7Days}
              disabled={loading}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-50`}
            >
              <ClockIcon size={16} className="inline mr-1" />
              Lembrar em 7 dias
            </button>
            
            <button
              onClick={handleDisableAutoBackup}
              disabled={loading}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-white/10 text-gray-300 hover:bg-white/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-50`}
            >
              Não mostrar mais
            </button>
          </div>
        </div>

        <p className={`text-xs mt-4 text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          💡 Você pode fazer backup a qualquer momento em Configurações
        </p>
      </div>
    </div>
  );
}