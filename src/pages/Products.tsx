import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { PlusIcon, RefreshIcon, EditIcon, TrashIcon, AlertIcon, LinkIcon } from '../components/Icons';
import { ExportButton } from '../components/ExportButton';
import { exportToCSV, exportToPDF, generateTableHTML } from '../utils/export';

interface Product {
  id: string;
  sku: string;
  ean: string;
  name: string;
  price: number;
  stock: number;
  accountId: string;
  accountName?: string;
}

interface Account {
  id: string;
  name: string;
  isActive: boolean;
  syncStatus?: string;
}

export default function Products() {
  const { isDarkMode } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    accountId: ''
  });

  useEffect(() => {
    loadProducts();
    loadAccounts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const result = await api.getProducts() as Product[];
      setProducts(result);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      showMessage('error', 'Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const result = await api.getAccounts() as Account[];
      setAccounts(result.filter((acc: Account) => acc.isActive));
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  const handleSyncBling = async () => {
    if (accounts.length === 0) {
      showMessage('error', 'Nenhuma conta Bling configurada');
      return;
    }

    setSyncing(true);
    try {
      let totalImported = 0;
      let totalUpdated = 0;

      for (const account of accounts) {
        const result = await api.syncAccount(account.id) as any;
        if (result.success) {
          totalImported += result.imported || 0;
          totalUpdated += result.updated || 0;
        }
      }

      showMessage('success', `Sincronização concluída! ${totalImported} novos, ${totalUpdated} atualizados`);
      await loadProducts();
    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      showMessage('error', 'Erro ao sincronizar com o Bling');
    } finally {
      setSyncing(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const formatPrice = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const cents = parseInt(numbers) || 0;
    const reais = cents / 100;
    return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parsePriceToNumber = (formattedPrice: string) => {
    return parseFloat(formattedPrice.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPrice(value);
    setFormData({ ...formData, price: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      
      const productData = {
        sku: formData.sku,
        name: formData.name,
        price: parsePriceToNumber(formData.price),
        stock: parseInt(formData.stock),
        accountId: formData.accountId,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, productData);
        showMessage('success', 'Produto atualizado com sucesso!');
      } else {
        await api.createProduct(productData);
        showMessage('success', 'Produto criado com sucesso!');
      }
      
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      await loadProducts();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      showMessage('error', error.message || 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      sku: '', 
      name: '', 
      price: 'R$ 0,00', 
      stock: '', 
      accountId: accounts.length > 0 ? accounts[0].id : '' 
    });
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || '',
      name: product.name || '',
      price: (product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      stock: (product.stock || 0).toString(),
      accountId: (product.accountId || '').toString()
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    
    try {
      await api.deleteProduct(id);
      showMessage('success', 'Produto excluído com sucesso!');
      loadProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      showMessage('error', 'Erro ao excluir produto');
    }
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const productColumns = [
    { key: 'sku', label: 'SKU' },
    { key: 'ean', label: 'EAN' },
    { key: 'name', label: 'Nome' },
    { key: 'price', label: 'Preço' },
    { key: 'stock', label: 'Estoque' },
    { key: 'accountName', label: 'Conta Bling' },
  ];

  const handleExportCSV = () => {
    exportToCSV(products, 'produtos', productColumns);
  };

  const handleExportPDF = () => {
    const tableHTML = generateTableHTML(products, productColumns);
    exportToPDF('Relatório de Produtos', tableHTML);
  };

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Produtos
            </h1>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Gerencie seus produtos integrados com o Bling
            </p>
          </div>
          <div className="flex gap-3">
            <ExportButton onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            <button
              onClick={handleSyncBling}
              disabled={syncing || accounts.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                isDarkMode 
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              } disabled:opacity-50`}
              title="Sincronizar produtos com o Bling"
            >
              <LinkIcon size={18} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Bling'}
            </button>
            <button
              onClick={loadProducts}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                isDarkMode 
                  ? 'bg-white/5 text-gray-300 hover:bg-white/10' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshIcon size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              onClick={handleNewProduct}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <PlusIcon size={18} />
              Novo Produto
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? isDarkMode ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-700 border border-green-200'
              : isDarkMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <AlertIcon size={20} />
            {message.text}
          </div>
        )}

        {/* Products Table */}
        {loading ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            <RefreshIcon size={24} className="animate-spin mx-auto mb-2" />
            Carregando produtos...
          </div>
        ) : products.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl border ${
            isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-gray-200 text-gray-500'
          }`}>
            <p className="mb-4">Nenhum produto encontrado</p>
            <button
              onClick={handleNewProduct}
              className="text-cyan-500 hover:text-cyan-400 font-medium"
            >
              Criar primeiro produto
            </button>
          </div>
        ) : (
          <div className={`rounded-2xl border overflow-hidden ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'
          }`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className={isDarkMode ? 'bg-white/5' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>SKU</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>EAN</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Nome</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Preço</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Estoque</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Conta Bling</th>
                    <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-white/10' : 'divide-gray-200'}`}>
                  {products.map((product) => (
                    <tr key={product.id} className={`transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>{product.sku}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{product.ean || '-'}</td>
                      <td className={`px-6 py-4 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        <div className="max-w-xs truncate" title={product.name}>{product.name}</div>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          product.stock > 10 
                            ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                            : product.stock > 0
                            ? isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                            : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.stock} un.
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                        {product.accountName || `Conta ${product.accountId}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(product)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-cyan-400 hover:bg-cyan-500/20' : 'text-cyan-600 hover:bg-cyan-100'}`} title="Editar produto">
                            <EditIcon size={18} />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100'}`} title="Excluir produto">
                            <TrashIcon size={18} />
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

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`rounded-2xl p-6 w-full max-w-md border ${isDarkMode ? 'bg-slate-800 border-white/10' : 'bg-white border-gray-200'}`}>
              <h2 className={`text-xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>SKU *</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="Ex: PROD001" required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Nome do Produto *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="Ex: Produto Exemplo" required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Preço *</label>
                  <input type="text" value={formData.price} onChange={handlePriceChange} className={`w-full rounded-xl px-4 py-3 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="R$ 0,00" required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Estoque Inicial *</label>
                  <input type="number" min="0" value={formData.stock} onChange={(e) => setFormData({ ...formData, stock: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`} placeholder="0" required />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Conta Bling</label>
                  <select value={formData.accountId} onChange={(e) => setFormData({ ...formData, accountId: e.target.value })} className={`w-full rounded-xl px-4 py-3 border outline-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`}>
                    <option value="">Selecione uma conta</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); }} disabled={saving} className={`px-6 py-3 rounded-xl transition-colors ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>Cancelar</button>
                  <button type="submit" disabled={saving} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                    {saving && <RefreshIcon size={16} className="animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
