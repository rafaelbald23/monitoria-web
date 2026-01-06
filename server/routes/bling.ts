import { Router, Request, Response } from 'express';
import axios from 'axios';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

// Detecta automaticamente a URL base
function getRedirectUri(req: Request): string {
  // Prioridade: variável de ambiente > headers > fallback
  if (process.env.BLING_REDIRECT_URI) {
    console.log('Usando BLING_REDIRECT_URI do env:', process.env.BLING_REDIRECT_URI);
    return process.env.BLING_REDIRECT_URI;
  }
  
  // Para Railway e outros proxies reversos
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001';
  const redirectUri = `${protocol}://${host}/api/bling/callback`;
  console.log('Redirect URI gerado automaticamente:', redirectUri);
  return redirectUri;
}

// Store pending OAuth states
const pendingStates = new Map<string, { accountId: string; userId: string; timestamp: number }>();

// Clean old states every minute
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      pendingStates.delete(state);
    }
  }
}, 60 * 1000);

// Start OAuth flow
router.post('/start-oauth', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.body;
    const userId = req.user!.userId;

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.clientId || !account.clientSecret) {
      return res.json({ success: false, error: 'Configure o Client ID e Client Secret primeiro!' });
    }

    // Generate state
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    pendingStates.set(state, { accountId, userId, timestamp: Date.now() });

    const redirectUri = getRedirectUri(req);
    console.log('Redirect URI:', redirectUri);
    
    const authUrl = `${BLING_AUTH_URL}?response_type=code&client_id=${account.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    res.json({ success: true, authUrl });
  } catch (error: any) {
    console.error('Erro ao iniciar OAuth:', error);
    res.json({ success: false, error: error.message });
  }
});

// OAuth callback
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">❌ Erro</h1>
            <p>${error}</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }

    const pendingData = pendingStates.get(state as string);
    if (!pendingData) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">❌ Erro</h1>
            <p>State inválido ou expirado</p>
          </body>
        </html>
      `);
    }

    const { accountId } = pendingData;
    pendingStates.delete(state as string);

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.send(`
        <html>
          <body style="font-family:Arial;text-align:center;padding:50px;">
            <h1 style="color:red;">❌ Erro</h1>
            <p>Conta não encontrada</p>
          </body>
        </html>
      `);
    }

    // Exchange code for tokens
    const credentials = Buffer.from(`${account.clientId}:${account.clientSecret}`).toString('base64');
    const redirectUri = getRedirectUri(req);

    const tokenResponse = await axios.post(
      BLING_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    const tokens = tokenResponse.data;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Save tokens
    await prisma.blingAccount.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        isActive: true,
        syncStatus: 'connected',
      },
    });

    res.send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:50px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;min-height:100vh;margin:0;">
          <div style="background:white;color:#333;padding:40px;border-radius:20px;display:inline-block;margin-top:50px;">
            <h1 style="color:#22c55e;">✅ Conectado!</h1>
            <p>Pode fechar esta janela e voltar ao sistema.</p>
            <script>
              setTimeout(() => {
                window.opener?.postMessage({ type: 'BLING_OAUTH_SUCCESS', accountId: '${accountId}' }, '*');
                window.close();
              }, 2000);
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('Erro no callback OAuth:', error.response?.data || error.message);
    res.send(`
      <html>
        <body style="font-family:Arial;text-align:center;padding:50px;">
          <h1 style="color:red;">❌ Erro</h1>
          <p>${error.response?.data?.error_description || error.message}</p>
        </body>
      </html>
    `);
  }
});

// Check auth status
router.get('/check-auth/:accountId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;

    const account = await prisma.blingAccount.findUnique({
      where: { id: accountId },
      select: {
        isActive: true,
        tokenExpiresAt: true,
        syncStatus: true,
      },
    });

    if (!account) {
      return res.json({ authenticated: false });
    }

    const isValid =
      account.isActive &&
      account.tokenExpiresAt &&
      account.tokenExpiresAt > new Date();

    res.json({ authenticated: isValid, syncStatus: account.syncStatus });
  } catch (error) {
    res.json({ authenticated: false });
  }
});

export default router;
