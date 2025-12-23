import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../hooks/useTheme';
import api from '../lib/api';
import { ScanIcon, TrashIcon, CheckIcon } from '../components/Icons';

interface Product {
  id: string;
  sku: string;
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

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const product = products.find(p => p.sku.toLowerCase() === barcode.toLowerCase() || p.sku.includes(barcode));

    if (product) {
      addToCart(product);
      setMessage({ type: 'success', text: `${product.name} adicionado!` });
      setTimeout(() => setMessage(null), 2000);
    } else {
      setMessage({ type: 'error', text: 'Produto não encontrado' });
      setTimeout(() => setMessage(null), 3000);
    }

    setBarcode('');
    barcodeInputRef.current?.focus();
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);
      
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.product.price }
            : item
        );
      }
      
      return [...prevCart, { product, quantity: 1, subtotal: product.price }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity, subtotal: quantity * item.product.price }
          : item
      )
    );
  };

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      setMessage({ type: 'error', text: 'Adicione produtos ao carrinho' });
      return;
    }

    setLoading(true);
    try {
      await api.createSale({
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.product.price,
          totalPrice: item.subtotal,
        })),
        totalAmount: total,
      });

      setMessage({ type: 'success', text: 'Venda registrada com sucesso!' });
      setCart([]);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao finalizar venda:', error);
      setMessage({ type: 'error', text: 'Erro ao registrar venda' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 h-full flex flex-col">
        <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Nova Venda</h1>

        <div className="flex gap-6 flex-1">
          {/* Scanner Area */}
          <div className="flex-1">
            <form onSubmit={handleBarcodeSubmit} className="mb-6">
              <div className={`flex items-center gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <ScanIcon size={24} className={isDarkMode ? 'text-cyan-400' : 'text-cyan-600'} />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Bipe o código de barras ou digite o SKU..."
                  className={`flex-1 bg-transparent outline-none text-lg ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                  autoFocus
                />
                <button type="submit" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl hover:opacity-90 transition-opacity">Adicionar</button>
              </div>
            </form>

            {message && (
              <div className={`mb-4 p-4 rounded-xl ${message.type === 'success' ? isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700' : isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <div className={`rounded-2xl border p-4 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
              <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Produtos Disponíveis</h3>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {products.slice(0, 20).map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={`p-3 rounded-xl text-left transition-colors ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-900'}`}
                  >
                    <p className="font-medium text-sm truncate">{product.name}</p>
                    <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>SKU: {product.sku}</p>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>R$ {product.price.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cart */}
          <div className={`w-96 rounded-2xl border flex flex-col ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Carrinho ({cart.length} itens)</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className={`text-center py-8 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Carrinho vazio</p>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className={`p-3 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.product.name}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>R$ {item.product.price.toFixed(2)} cada</p>
                      </div>
                      <button onClick={() => removeFromCart(item.product.id)} className={`p-1 rounded ${isDarkMode ? 'text-red-400 hover:bg-red-500/20' : 'text-red-600 hover:bg-red-100'}`}>
                        <TrashIcon size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>-</button>
                        <span className={`w-8 text-center font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>+</button>
                      </div>
                      <p className={`font-semibold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>R$ {item.subtotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={`p-4 border-t ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center mb-4">
                <span className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total:</span>
                <span className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>R$ {total.toFixed(2)}</span>
              </div>
              <button
                onClick={handleFinalizeSale}
                disabled={cart.length === 0 || loading}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckIcon size={20} />
                {loading ? 'Processando...' : 'Finalizar Venda'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
