import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import OrderDetailsModal from '../components/OrderDetailsModal';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { RefreshIcon, FilterIcon, PlusIcon, DollarIcon, ShoppingCartIcon, AlertIcon } from '../components/Icons';
import { ExportButton } from '../components/ExportButton';
import { exportToCSV, exportToPDF, generateTableHTML } from '../utils/export';

interface BlingOrder {
  id: string;
  blingOrderId: string;
  orderNumber: string;
  status: string;
  customerName: string | null;
  totalAmount: number;
  items: any[];
  isProcessed: boolean;
  createdAt: string;
  blingCreatedAt: string | null;
}

interface Account {
  id: string;
  name: string;
  isActive: boolean;
}

export default function Sales() {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const [blingOrders, setBlingOrders] = useState<BlingOrder[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, verified: 0, processed: 0 });
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<BlingOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      loadBlingOrders();
    }
  }, [accounts]);

  const loadAccounts = async () => {
    try {
      const result = await api.getAccounts() as Account[];
      setAccounts(result.filter(acc => acc.isActive));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const loadBlingOrders = async () => {
    try {
      setLoading(true);
      let allOrders: BlingOrder[] = [];
      
      for (const account of accounts) {
        const result = await api.getAllBlingOrders(account.id) as any;
        if (result.success && result.orders) {
          allOrders = [...allOrders, ...result.orders.map((o: any) => ({ ...o, accountName: account.name }))];
        }
      }
      
      // Ordenar por data do Bling (mais recente primeiro)
      allOrders.sort((a, b) => {
        const dateA = a.blingCreatedAt ? new Date(a.blingCreatedAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.blingCreatedAt ? new Date(b.blingCreatedAt).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setBlingOrders(allOrders);
      
      // Calcular estatísticas
      setStats({
        totalOrders: allOrders.length,
        totalRevenue: allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
        verified: allOrders.filter(o => o.status === 'Verificado' || o.status === 'Checado').length,
        processed: allOrders.filter(o => o.isProcessed).length,
      });
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order: BlingOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleProcessOrder = async (orderId: string) => {
    try {
      const response = await fetch(`/api/bling/orders/${orderId}/process`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        showMessage('success', result.message);
        setIsModalOpen(false);
        await loadBlingOrders();
      } else {
        showMessage('error', `Erro ao processar: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro ao processar pedido:', error);
      showMessage('error', `Erro ao processar: ${error.message}`);
    }
  };

  const handleCorrectStatus = async (orderNumber: string) => {
    if (!accounts.length) {
      showMessage('error', 'Nenhuma conta conectada');
      return;
    }
    
    // Perguntar qual é o status correto
    const correctStatus = prompt('Qual é o status correto que você vê na interface do Bling?\n\nExemplos: Verificado, Checado, Aprovado, Pronto para Envio');
    
    if (!correctStatus || correctStatus.trim().length === 0) {
      showMessage('error', 'Status não informado');
      return;
    }
    
    try {
      const account = accounts[0];
      const response = await fetch(`/api/bling/force-status-correction/${account.id}/${orderNumber}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ correctStatus: correctStatus.trim() })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('🔧 CORREÇÃO RESULTADO:', result);
      
      if (result.success) {
        showMessage('success', result.message);
        // Recarregar dados
        await loadBlingOrders();
      } else {
        showMessage('error', `Erro na correção: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro na correção:', error);
      showMessage('error', `Erro na correção: ${error.message}`);
    }
  };

  const handleInvestigateOrder = async (orderNumber: string) => {
    if (!accounts.length) {
      showMessage('error', 'Nenhuma conta conectada');
      return;
    }
    
    try {
      const account = accounts[0];
      const response = await fetch(`/api/bling/investigate-order/${account.id}/${orderNumber}`, {
        method: 'GET',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('🔍 INVESTIGAÇÃO COMPLETA:', result);
      
      if (result.success) {
        const inv = result.investigation;
        const msg = `INVESTIGAÇÃO #${orderNumber}:
        
DB: ${inv.database.status || 'NÃO ENCONTRADO'}
Bling: ${inv.bling.finalStatusCalculado}
Campo usado: ${inv.bling.foundField || 'ID: ' + inv.bling.situacaoId}
Precisa atualizar: ${inv.comparison.needsUpdate ? 'SIM' : 'NÃO'}
Deve processar estoque: ${inv.comparison.shouldProcessStock ? 'SIM' : 'NÃO'}`;
        
        showMessage('info', msg);
      } else {
        showMessage('error', `Erro na investigação: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro na investigação:', error);
      showMessage('error', `Erro na investigação: ${error.message}`);
    }
  };

  const handleDebugOrder = async (orderNumber: string) => {
    if (!accounts.length) {
      showMessage('error', 'Nenhuma conta conectada');
      return;
    }
    
    try {
      const account = accounts[0]; // Usar primeira conta para teste
      const response = await fetch(`/api/bling/debug-status/${account.id}/${orderNumber}`, {
        method: 'GET',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('🔍 DEBUG RESULTADO:', result);
      
      if (result.success) {
        showMessage('info', `Debug concluído - Status: ${result.debug.finalStatus} (Precisa baixa: ${result.debug.needsProcessing ? 'SIM' : 'NÃO'})`);
      } else {
        showMessage('error', `Erro no debug: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro no debug:', error);
      showMessage('error', `Erro no debug: ${error.message}`);
    }
  };

  const handleForceSyncOrder = async (orderNumber: string) => {
    if (!accounts.length) {
      showMessage('error', 'Nenhuma conta conectada');
      return;
    }
    
    try {
      const account = accounts[0]; // Usar primeira conta para teste
      const response = await fetch(`/api/bling/force-sync-order/${account.id}/${orderNumber}`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log('🔧 FORÇA SYNC RESULTADO:', result);
      
      if (result.success) {
        showMessage('success', result.message);
        // Recarregar dados
        await loadBlingOrders();
      } else {
        showMessage('error', `Erro na sincronização: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Erro na sincronização forçada:', error);
      showMessage('error', `Erro na sincronização: ${error.message}`);
    }
  };

  const handleSyncOrders = async () => {
    setSyncing(true);
    try {
      let totalSynced = 0;
      let errors: string[] = [];
      
      showMessage('info', `Sincronizando ${accounts.length} conta(s)...`);
      
      for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        console.log('Sincronizando conta:', account.name, account.id);
        
        // Mostrar progresso
        showMessage('info', `Sincronizando ${account.name} (${i + 1}/${accounts.length})...`);
        
        try {
          const result = await api.getBlingOrders(account.id) as any;
          console.log('Resultado sync:', result);
          
          if (result.success) {
            if (result.orders && result.orders.length > 0) {
              totalSynced += result.orders.length;
              console.log(`Sincronizados ${result.orders.length} pedidos da conta ${account.name}`);
            } else {
              console.log(`Nenhum pedido encontrado na conta ${account.name}`);
            }
          } else {
            const errorMsg = result.error || 'Erro desconhecido';
            errors.push(`${account.name}: ${errorMsg}`);
            console.error(`Erro na conta ${account.name}:`, errorMsg);
          }
        } catch (accountError: any) {
          const errorMsg = accountError.message || 'Erro de conexão';
          errors.push(`${account.name}: ${errorMsg}`);
          console.error(`Erro na conta ${account.name}:`, accountError);
        }
      }
      
      console.log('Total sincronizado:', totalSynced);
      
      // Recarregar dados após sincronização
      showMessage('info', 'Atualizando lista de pedidos...');
      await loadBlingOrders();
      
      // Mostrar resultado da sincronização
      if (errors.length > 0) {
        showMessage('error', `Erros na sincronização: ${errors.join('; ')}`);
      } else if (totalSynced > 0) {
        showMessage('success', `${totalSynced} pedidos sincronizados em tempo otimizado!`);
      } else {
        showMessage('info', 'Sincronização concluída. Nenhum pedido novo encontrado.');
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      showMessage('error', `Erro geral na sincronização: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      // Status de Verificação/Aprovação (Verde)
      'Verificado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Checado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      'Aprovado': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-200',
      
      // Status de Processamento (Azul)
      'Atendido': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      'Faturado': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      'Processando': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200',
      
      // Status de Preparação (Roxo)
      'Pronto para Envio': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      'Pronto': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      'Impresso': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      'Separado': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      'Embalado': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200',
      
      // Status de Envio (Ciano)
      'Enviado': isDarkMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Coletado': isDarkMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'Em Trânsito': isDarkMode ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' : 'bg-cyan-100 text-cyan-700 border-cyan-200',
      
      // Status de Entrega (Verde Esmeralda)
      'Entregue': isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Tentativa de Entrega': isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
      
      // Status de Espera (Amarelo)
      'Em Andamento': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Aguardando': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Aguardando Processamento': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Pendente': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Reagendado': isDarkMode ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-yellow-100 text-yellow-700 border-yellow-200',
      
      // Status Iniciais (Laranja)
      'Em Aberto': isDarkMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200',
      'Em Digitação': isDarkMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-200',
      
      // Status Problemáticos (Vermelho)
      'Cancelado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Não Entregue': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Devolvido': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Extraviado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Reprovado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Bloqueado': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      'Suspenso': isDarkMode ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-200',
      
      // Status Especiais (Rosa)
      'Venda Agenciada': isDarkMode ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' : 'bg-pink-100 text-pink-700 border-pink-200',
      'Estornado': isDarkMode ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' : 'bg-pink-100 text-pink-700 border-pink-200',
    };
    
    // Se não encontrar o status específico, verifica se começa com "Status" (ex: "Status 99")
    if (!colors[status] && status.startsWith('Status ')) {
      return isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
    
    return colors[status] || (isDarkMode ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-gray-100 text-gray-700 border-gray-200');
  };

  const allStatuses = ['all', 'Verificado', 'Checado', 'Atendido', 'Em Andamento', 'Em Aberto', 'Cancelado', 'Enviado', 'Entregue', 'Pronto para Envio'];
  
  const filteredOrders = blingOrders.filter(order => filter === 'all' || order.status === filter);

  const columns = [
    { key: 'orderNumber', label: 'Pedido' },
    { key: 'blingCreatedAt', label: 'Data' },
    { key: 'customerName', label: 'Cliente' },
    { key: 'totalAmount', label: 'Valor' },
    { key: 'status', label: 'Status' },
    { key: 'itemsCount', label: 'Qtd Itens' },
    { key: 'itemsDetails', label: 'Produtos' },
  ];

  const handleExportCSV = () => {
    // Preparar dados com detalhes dos produtos
    const dataWithDetails = filteredOrders.map(order => ({
      ...order,
      itemsCount: order.items ? JSON.parse(order.items).length : 0,
      itemsDetails: order.items ? 
        JSON.parse(order.items).map((item: any) => {
          const sku = item.codigo || item.produto?.codigo || '';
          const nome = item.nome || item.produto?.nome || '';
          const ean = item.ean || item.produto?.ean || '';
          const qtd = item.quantidade || 1;
          return `${nome} (SKU: ${sku}, EAN: ${ean}, Qtd: ${qtd})`;
        }).join('; ') : ''
    }));
    exportToCSV(dataWithDetails, 'pedidos-bling-detalhado', columns);
  };
  
  const handleExportPDF = () => {
    const dataWithDetails = filteredOrders.map(order => ({
      ...order,
      itemsCount: order.items ? JSON.parse(order.items).length : 0,
      itemsDetails: order.items ? 
        JSON.parse(order.items).map((item: any) => {
          const nome = item.nome || item.produto?.nome || '';
          const qtd = item.quantidade || 1;
          return `${nome} (${qtd}x)`;
        }).join(', ') : ''
    }));
    const tableHTML = generateTableHTML(dataWithDetails, columns);
    exportToPDF('Pedidos Bling - Detalhado com Produtos', tableHTML);
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={"text-2xl font-bold " + (isDarkMode ? 'text-white' : 'text-gray-900')}>Vendas / Pedidos Bling</h1>
            <p className={"text-sm " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>Pedidos dos últimos 3 meses sincronizados do Bling</p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            <button onClick={handleSyncOrders} disabled={syncing} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium bg-purple-600/30 text-purple-400 hover:bg-purple-600/40 border border-purple-500/30 transition-all disabled:opacity-50">
              <RefreshIcon size={18} className={syncing ? 'animate-spin' : ''} />
              Sincronizar Bling
            </button>
            <button onClick={() => navigate('/new-sale')} className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              <PlusIcon size={18} />
              Nova Venda
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-purple-500/20' : 'bg-purple-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-purple-400' : 'text-purple-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Total Pedidos</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-white' : 'text-gray-900')}>{stats.totalOrders}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-green-500/20' : 'bg-green-100')}>
                <DollarIcon size={20} className={isDarkMode ? 'text-green-400' : 'text-green-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Receita Total</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-green-400' : 'text-green-600')}>{stats.totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Verificados</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-cyan-400' : 'text-cyan-600')}>{stats.verified}</p>
              </div>
            </div>
          </div>
          <div className={"rounded-xl p-4 border " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                <ShoppingCartIcon size={20} className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} />
              </div>
              <div>
                <p className={"text-xs " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Processados</p>
                <p className={"text-lg font-bold " + (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')}>{stats.processed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' 
              ? (isDarkMode ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200')
              : message.type === 'error'
              ? (isDarkMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-700 border border-red-200')
              : (isDarkMode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-200')
          }`}>
            <AlertIcon size={20} />
            {message.text}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="relative">
            <div className={"absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
              <FilterIcon size={16} />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={"pl-10 pr-8 py-2 rounded-xl border outline-none appearance-none cursor-pointer transition-colors " + (isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50')}>
              <option value="all" className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>Todos os Status</option>
              {allStatuses.filter(s => s !== 'all').map(status => (
                <option key={status} value={status} className={isDarkMode ? 'bg-slate-800' : 'bg-white'}>{status}</option>
              ))}
            </select>
          </div>
          <span className={"text-sm " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>{filteredOrders.length} pedido(s)</span>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className={"text-center py-8 " + (isDarkMode ? 'text-gray-400' : 'text-gray-600')}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando pedidos...
          </div>
        ) : accounts.length === 0 ? (
          <div className={"text-center py-16 rounded-2xl border " + (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500')}>
            <ShoppingCartIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhuma conta Bling conectada</p>
            <button onClick={() => navigate('/accounts')} className="text-purple-500 hover:text-purple-400 font-medium">Conectar conta Bling</button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className={"text-center py-16 rounded-2xl border " + (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500')}>
            <ShoppingCartIcon size={48} className="mx-auto mb-4 opacity-50" />
            <p className="mb-4">Nenhum pedido encontrado</p>
            <button onClick={handleSyncOrders} disabled={syncing} className="text-purple-500 hover:text-purple-400 font-medium disabled:opacity-50">
              {syncing ? 'Sincronizando...' : 'Sincronizar com Bling'}
            </button>
          </div>
        ) : (
          <div className={"rounded-2xl border overflow-hidden " + (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm')}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                  <tr>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Pedido</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Data</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Cliente</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Valor</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Status</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Baixa</th>
                    <th className={"px-6 py-3 text-left text-xs font-medium uppercase tracking-wider " + (isDarkMode ? 'text-gray-400' : 'text-gray-500')}>Debug</th>
                  </tr>
                </thead>
                <tbody className={"divide-y " + (isDarkMode ? 'divide-white/10' : 'divide-gray-200')}>
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order.id} 
                      className={`transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                      onClick={() => handleOrderClick(order)}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                          <span>#{order.orderNumber}</span>
                          {order.items && JSON.parse(order.items).length > 0 && (
                            <span className={`px-2 py-1 rounded text-xs ${isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                              {JSON.parse(order.items).length} item(s)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {order.blingCreatedAt 
                          ? new Date(order.blingCreatedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                          : new Date(order.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
                        }
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        {order.customerName || '-'}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {(order.totalAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={"px-3 py-1 rounded-full text-xs font-medium border " + getStatusColor(order.status)}>{order.status}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {order.isProcessed ? (
                          <span className={"px-2 py-1 rounded text-xs " + (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')}>✓ Processado</span>
                        ) : (order.status === 'Verificado' || order.status === 'Checado') ? (
                          <span className={"px-2 py-1 rounded text-xs " + (isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700')}>Pendente</span>
                        ) : (
                          <span className={"text-xs " + (isDarkMode ? 'text-gray-500' : 'text-gray-400')}>-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleCorrectStatus(order.orderNumber)} 
                            className={"px-2 py-1 rounded text-xs font-medium " + (isDarkMode ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200')}
                            title="Corrigir Status"
                          >
                            ✅
                          </button>
                          <button 
                            onClick={() => handleInvestigateOrder(order.orderNumber)} 
                            className={"px-2 py-1 rounded text-xs font-medium " + (isDarkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200')}
                            title="Investigar Status"
                          >
                            🕵️
                          </button>
                          <button 
                            onClick={() => handleDebugOrder(order.orderNumber)} 
                            className={"px-2 py-1 rounded text-xs font-medium " + (isDarkMode ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200')}
                            title="Debug Status"
                          >
                            🔍
                          </button>
                          <button 
                            onClick={() => handleForceSyncOrder(order.orderNumber)} 
                            className={"px-2 py-1 rounded text-xs font-medium " + (isDarkMode ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'bg-orange-100 text-orange-700 hover:bg-orange-200')}
                            title="Forçar Sync"
                          >
                            🔧
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      <OrderDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        order={selectedOrder}
        onProcessOrder={handleProcessOrder}
      />
    </Layout>
  );
}
