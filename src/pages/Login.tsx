import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Logo } from '../components/Logo';
import { UserIcon, LockIcon, EyeIcon, EyeOffIcon, SunIcon, MoonIcon, LoadingSpinner } from '../components/Icons';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { login, isLoading, error, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(username, password);
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-500 ${
      isDarkMode 
        ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' 
        : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
    }`}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl opacity-20 animate-pulse ${
          isDarkMode ? 'bg-cyan-500' : 'bg-cyan-300'
        }`}></div>
        <div className={`absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
          isDarkMode ? 'bg-purple-500' : 'bg-purple-300'
        }`} style={{ animationDelay: '1s' }}></div>
        <div className={`absolute top-1/2 left-1/2 w-64 h-64 rounded-full blur-3xl opacity-10 animate-pulse ${
          isDarkMode ? 'bg-pink-500' : 'bg-pink-300'
        }`} style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Theme Toggle */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className={`absolute top-6 right-6 p-3 rounded-full backdrop-blur-md transition-all duration-300 hover:scale-110 ${
          isDarkMode 
            ? 'bg-white/10 text-white hover:bg-white/20' 
            : 'bg-black/10 text-gray-800 hover:bg-black/20'
        }`}
        aria-label="Toggle theme"
      >
        {isDarkMode ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      </button>

      {/* Login Card */}
      <div className={`relative w-full max-w-md backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 ${
        isDarkMode 
          ? 'bg-white/10 border border-white/20' 
          : 'bg-white/80 border border-white/40'
      }`}>
        {/* Gradient Border Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-20 blur-xl"></div>
        
        <div className="relative p-8">
          {/* Logo Section */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <Logo size={80} />
            </div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              monitorIA
            </h1>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Sistema de Gestão de Estoque
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Usuário
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <UserIcon size={18} />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 rounded-xl backdrop-blur-md transition-all duration-300 outline-none ${
                    isDarkMode 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:bg-white/15 focus:border-cyan-500/50' 
                      : 'bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-purple-500'
                  }`}
                  placeholder="Digite seu usuário"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Senha
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <LockIcon size={18} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 rounded-xl backdrop-blur-md transition-all duration-300 outline-none ${
                    isDarkMode 
                      ? 'bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:bg-white/15 focus:border-purple-500/50' 
                      : 'bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-500 focus:bg-white focus:border-purple-500'
                  }`}
                  placeholder="Digite sua senha"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 pr-4 flex items-center transition-colors ${
                    isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-800'
                  }`}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`p-4 rounded-xl backdrop-blur-md border ${
                isDarkMode 
                  ? 'bg-red-500/20 border-red-500/50 text-red-200' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                isDarkMode
                  ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60'
                  : 'bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-purple-400/50 hover:shadow-xl hover:shadow-purple-400/60'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner size={20} className="mr-2" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className={`mt-6 text-center text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <p>Powered by monitorIA - 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}
