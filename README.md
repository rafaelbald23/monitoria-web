# 🌐 monitorIA Web - Sistema de Gestão de Estoque

Sistema web de gestão de estoque integrado ao Bling ERP.

## 🚀 Início Rápido

### 1. Instalar dependências
```bash
cd web
npm install
```

### 2. Configurar banco de dados
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### 3. Iniciar em desenvolvimento
```bash
npm run dev
```

Acesse: **http://localhost:5173**

### Credenciais padrão
- **Usuário:** admin
- **Senha:** admin123

## 📦 Build para Produção

```bash
npm run build
npm start
```

## 🔧 Configuração do Bling

1. Acesse sua conta no Bling
2. Vá em Configurações → Integrações → API
3. Crie um novo aplicativo
4. No campo "URL de Callback" coloque: `http://localhost:3001/api/bling/callback`
5. Copie o Client ID e Client Secret
6. No sistema, vá em "Contas Bling" e adicione uma nova conta com as credenciais

## 🌍 Deploy

Para deploy em produção, configure as variáveis de ambiente:

```env
DATABASE_URL="postgresql://user:password@host:5432/monitoria"
JWT_SECRET="sua-chave-secreta-muito-segura"
NODE_ENV=production
PORT=3001
FRONTEND_URL="https://seu-dominio.com"
BLING_REDIRECT_URI="https://seu-dominio.com/api/bling/callback"
```

### Deploy no Railway/Render/Vercel

1. Faça push do código para o GitHub
2. Conecte o repositório ao serviço de deploy
3. Configure as variáveis de ambiente
4. O build será feito automaticamente

## 📋 Funcionalidades

- ✅ Dashboard com métricas
- ✅ Gestão de produtos
- ✅ Sistema de vendas (PDV)
- ✅ Integração OAuth com Bling
- ✅ Sincronização de produtos
- ✅ Relatórios
- ✅ Tema claro/escuro
- ✅ Autenticação JWT
