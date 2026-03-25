import { useNavigate } from 'react-router-dom';
import { Package, TrendingUp, Users, CheckCircle, ArrowRight, BarChart3, ShoppingCart, RefreshCw, AlertTriangle, Zap, Shield, Clock, MessageCircle } from 'lucide-react';
import { Logo } from '../components/Logo';

export default function LandingPage() {
  const navigate = useNavigate();

  // Número do WhatsApp (formato: 5511999999999)
  const whatsappNumber = "5511999999999"; // ALTERE PARA SEU NÚMERO
  const whatsappMessage = "Olá! Gostaria de saber mais sobre as soluções para e-commerce.";

  const openWhatsApp = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  const problems = [
    {
      icon: AlertTriangle,
      title: 'Perda de Vendas',
      description: 'Produtos fora de estoque sem você saber? Perdendo vendas por falta de controle?',
      impact: 'Até 30% de perda de faturamento'
    },
    {
      icon: Clock,
      title: 'Processos Manuais',
      description: 'Gastando horas atualizando planilhas e sincronizando dados manualmente?',
      impact: 'Tempo que poderia estar vendendo'
    },
    {
      icon: BarChart3,
      title: 'Falta de Visibilidade',
      description: 'Não sabe quais produtos vendem mais ou quando repor estoque?',
      impact: 'Decisões sem dados concretos'
    },
    {
      icon: RefreshCw,
      title: 'Integrações Quebradas',
      description: 'Problemas constantes com sincronização entre plataformas?',
      impact: 'Erros e retrabalho diário'
    }
  ];

  const solutions = [
    {
      icon: Shield,
      title: 'Monitoramento Inteligente',
      description: 'Alertas automáticos de estoque baixo, falhas de sincronização e problemas críticos'
    },
    {
      icon: Zap,
      title: 'Automação Total',
      description: 'Sincronização automática com Bling, atualizações em tempo real e processos otimizados'
    },
    {
      icon: BarChart3,
      title: 'Análises Acionáveis',
      description: 'Dashboards com métricas que realmente importam para tomar decisões rápidas'
    },
    {
      icon: Users,
      title: 'Soluções Personalizadas',
      description: 'Desenvolvemos funcionalidades específicas para resolver SUA dor'
    }
  ];

  const benefits = [
    '✅ Aumente suas vendas em até 40%',
    '✅ Reduza erros operacionais em 90%',
    '✅ Economize até 20h/semana em processos manuais',
    '✅ Tome decisões baseadas em dados reais',
    '✅ Integração completa com Bling ERP',
    '✅ Suporte dedicado e personalizado'
  ];

  const testimonials = [
    {
      text: 'Antes perdíamos vendas por falta de controle. Agora temos visibilidade total do estoque.',
      author: 'Loja de Eletrônicos',
      result: '+35% em vendas'
    },
    {
      text: 'Economizamos 15 horas por semana que gastávamos atualizando planilhas manualmente.',
      author: 'E-commerce de Moda',
      result: '15h/semana economizadas'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* WhatsApp Floating Button */}
      <button
        onClick={openWhatsApp}
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 flex items-center gap-2 group"
        title="Fale conosco no WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
          Fale Conosco
        </span>
      </button>

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl shadow-lg sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Logo size={40} />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                monitorIA
              </h1>
              <p className="text-xs text-gray-400">Soluções para E-commerce</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={openWhatsApp}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
            >
              Entrar
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <Logo size={120} />
          </div>
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-full text-red-400 text-sm font-semibold">
              🚨 Seu e-commerce está perdendo dinheiro?
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Pare de Perder Vendas por
            <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mt-2">
              Falhas no seu E-commerce
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Desenvolvemos sistemas personalizados para resolver as dores específicas do seu negócio. 
            Estoque descontrolado? Integrações quebradas? Processos manuais? Nós resolvemos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={openWhatsApp}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg flex items-center justify-center gap-2 shadow-lg shadow-green-500/50"
            >
              <MessageCircle className="w-5 h-5" />
              Quero uma Solução Personalizada
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const contactSection = document.getElementById('contact');
                contactSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 rounded-xl hover:bg-white/20 transition-colors font-semibold text-lg"
            >
              Ver Como Funciona
            </button>
          </div>
        </div>
      </section>

      {/* Problems Section - DOR DO CLIENTE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Reconhece Algum Desses Problemas?
          </h2>
          <p className="text-gray-400 text-lg">
            Essas são as principais falhas que fazem e-commerces perderem dinheiro todos os dias
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {problems.map((problem, index) => (
            <div key={index} className="p-6 rounded-2xl bg-red-500/5 backdrop-blur-xl border border-red-500/20 hover:border-red-500/40 transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <problem.icon className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">{problem.title}</h3>
                  <p className="text-gray-400 mb-2">{problem.description}</p>
                  <p className="text-red-400 font-semibold text-sm">💸 {problem.impact}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <button
            onClick={openWhatsApp}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg inline-flex items-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Quero Resolver Esses Problemas Agora
          </button>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
          Como Resolvemos Suas Dores
        </h2>
        <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto text-lg">
          Não vendemos um sistema pronto. Criamos a solução perfeita para o SEU problema.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {solutions.map((solution, index) => (
            <div key={index} className="text-center p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-105">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-xl mb-4">
                <solution.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{solution.title}</h3>
              <p className="text-gray-400">{solution.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl p-12 border border-white/10">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
            Resultados Reais que Nossos Clientes Alcançam
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3 text-gray-300 text-lg">
                <span>{benefit}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button
              onClick={openWhatsApp}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg inline-flex items-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Quero Esses Resultados no Meu Negócio
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
          O Que Nossos Clientes Dizem
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
              <p className="text-gray-300 text-lg mb-4 italic">"{testimonial.text}"</p>
              <div className="flex justify-between items-center">
                <p className="text-gray-400">— {testimonial.author}</p>
                <span className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full text-green-400 text-sm font-semibold">
                  {testimonial.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Solutions CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center">
          <Users className="w-20 h-20 text-purple-400 mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Cada Negócio é Único
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Não acreditamos em soluções genéricas. Analisamos profundamente as dores do seu e-commerce 
            e desenvolvemos um sistema sob medida para resolver exatamente o que você precisa.
          </p>
          <ul className="text-left max-w-xl mx-auto space-y-3 mb-8">
            <li className="flex items-center gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              Análise gratuita das suas necessidades
            </li>
            <li className="flex items-center gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0" />
              Desenvolvimento personalizado
            </li>
            <li className="flex items-center gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-pink-400 flex-shrink-0" />
              Suporte dedicado pós-implementação
            </li>
            <li className="flex items-center gap-3 text-gray-300">
              <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              Integrações com suas ferramentas atuais
            </li>
          </ul>
          <button
            onClick={openWhatsApp}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg inline-flex items-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Quero uma Análise Gratuita
          </button>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-4">
            Pronto para Resolver as Falhas do Seu E-commerce?
          </h2>
          <p className="text-center text-gray-300 mb-8 text-lg">
            Preencha o formulário ou chame no WhatsApp para uma conversa sem compromisso
          </p>
          <form className="max-w-2xl mx-auto space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  E-mail
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Telefone / WhatsApp
              </label>
              <input
                type="tel"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Qual a principal dor do seu e-commerce?
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="Ex: Perco vendas por falta de controle de estoque, gasto muito tempo com processos manuais..."
              />
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 px-8 py-4 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white rounded-xl hover:opacity-90 transition-opacity font-semibold text-lg"
              >
                Enviar Mensagem
              </button>
              <button
                type="button"
                onClick={openWhatsApp}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors font-semibold text-lg flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                WhatsApp
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <Logo size={40} />
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  monitorIA
                </h1>
                <p className="text-xs text-gray-400">Soluções para E-commerce</p>
              </div>
            </div>
            <p className="text-gray-400">
              © 2026 monitorIA. Resolvendo as dores do seu e-commerce.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
