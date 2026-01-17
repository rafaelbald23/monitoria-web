import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { ScanIcon, TrashIcon, CheckIcon, AlertIcon } from '../components/Icons';

interface Product {
  id: string;
  sku: string;
  ean: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export default function NewSale() {
  const { isDarkMode } = useTheme();
  const [barcode, setBarcode] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const loadProducts = async () => {
    try {
      const result = await api.getProducts();
      setProducts(result as Product[]);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    try {
      const product = await api.searchProduct(barcode.trim()) as Product;
      addToCart(product);
      setMessage({ type: 'success', text: `${product.name} adicionado!` });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      const localProduct = products.find(p => 
        p.sku.toLowerCase() === barcode.toLowerCase() || 
        p.ean === barcode ||
        p.sku.includes(barcode)
      );

      if (localProduct) {
        addToCart(localProduct);
        setMessage({ type: 'success', text: `${localProduct.name} adicionado!` });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: 'error', text: 'Produto não encontrado' });
        setTimeout(() => setMessage(null), 3000);
      }
    }

    setBarcode('');
    barcodeInputRef.current?.focus();
  };

  const addToCart = (product: Product, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity, subtotal: (item.quantity + quantity) * item.product.price }
            : item
        );
      }
      
      return [...prevCart, { product, quantity, subtotal: product.price * quantity }];
    });
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.product.price }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const finalizeSale = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Carrinho vazio!' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setLoading(true);
    try {
      const saleData = {
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.subtotal,
        })),
        totalAmount: cart.reduce((sum, item) => sum + item.subtotal, 0),
        paymentMethod: 'cash',
      };

      await api.createSale(saleData);
      
      setMessage({ type: 'success', text: 'Venda finalizada com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
      clearCart();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Erro ao finalizar venda' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Nova Venda</h1>
          <div className={`px-4 py-2 rounded-xl ${isDarkMode ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'}`}>
            <span className="text-sm">🔥 Baixa automática ativada para pedidos Faturados/Enviados</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner e Busca */}
          <div className="space-y-4">
            <form onSubmit={handleBarcodeSubmit} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                <ScanIcon size={20} className="inline mr-2" />
                Scanner / Busca
              </h3>
              <div className="flex gap-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Código de barras, SKU ou nome do produto"
                  className={`flex-1 px-4 py-3 rounded-xl border outline-none ${isDarkMode ? 'bg-slate-700/50 border-slate-600 text-white placeholder-gray-400 focus:border-purple-500' : 'bg-white border-gray-300 text-gray-900 focus:border-purple-500'}`}
                />
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity">Adicionar</button>
              </div>
            </form>

            {message && (
              <div className={`p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
                <AlertIcon size={18} />
                {message.text}
              </div>
            )}
          </div>

          {/* Carrinho */}
          <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Carrinho</h3>
              {cart.length > 0 && (
                <button onClick={clearCart} className={`text-sm ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-500'}`}>
                  Limpar
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Carrinho vazio
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className={`p-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.product.name}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>SKU: {item.product.sku}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} className={`p-1 rounded ${isDarkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100'}`}>
                        <TrashIcon size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className={`w-8 h-8 rounded-lg ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>-</button>
                        <span className={`w-12 text-center ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className={`w-8 h-8 rounded-lg ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>+</button>
                      </div>
                      <p className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                        {item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total:</span>
                  <span className={`text-xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <button
                  onClick={finalizeSale}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Finalizando...' : (
                    <>
                      <CheckIcon size={20} className="inline mr-2" />
                      Finalizar Venda
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}