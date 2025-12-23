# 🚀 Deploy do monitorIA Web

## Opção 1: Railway (Recomendado - Gratuito)

### Passo a passo:

1. **Crie uma conta no Railway**
   - Acesse: https://railway.app
   - Faça login com GitHub

2. **Crie um novo projeto**
   - Clique em "New Project"
   - Selecione "Deploy from GitHub repo"
   - Conecte seu repositório

3. **Configure as variáveis de ambiente**
   No painel do Railway, adicione:
   ```
   DATABASE_URL=file:./prod.db
   JWT_SECRET=sua-chave-secreta-muito-segura-aqui
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://seu-app.railway.app
   BLING_REDIRECT_URI=https://seu-app.railway.app/api/bling/callback
   ```

4. **Configure o build**
   - Build Command: `npm run build`
   - Start Command: `npm start`

5. **Gere um domínio público**
   - Vá em Settings → Domains
   - Clique em "Generate Domain"

---

## Opção 2: Render (Gratuito)

1. Acesse: https://render.com
2. Crie um "Web Service"
3. Conecte o repositório GitHub
4. Configure:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. Adicione as variáveis de ambiente

---

## Opção 3: Vercel + Supabase

### Backend (Vercel Serverless)
1. Adapte o servidor para serverless functions
2. Deploy no Vercel

### Banco de dados (Supabase)
1. Crie conta em https://supabase.com
2. Crie um projeto PostgreSQL
3. Use a connection string no DATABASE_URL

---

## 📋 Checklist antes do deploy

- [ ] Alterar JWT_SECRET para uma chave segura
- [ ] Configurar DATABASE_URL para produção
- [ ] Atualizar BLING_REDIRECT_URI com URL de produção
- [ ] Atualizar callback no painel do Bling

## 🔗 Compartilhando com o cliente

Após o deploy, você terá uma URL como:
- `https://seu-app.railway.app`
- `https://seu-app.onrender.com`

Basta enviar esse link para seu cliente!
