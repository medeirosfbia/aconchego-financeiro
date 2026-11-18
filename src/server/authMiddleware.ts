import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';

export interface AuthContext {
  userId: string;
  email: string;
  isDemo: boolean;
  accessToken: string;
  supabase: SupabaseClient | null;
}

export type AuthenticatedRequest = Request & { auth: AuthContext };

export type TokenVerifier = (token: string) => Promise<AuthContext | null>;

function getSupabaseServerConfig(): { url: string; anonKey: string } | null {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();
  if (!url || !anonKey || url.includes('SEU-PROJETO') || anonKey.includes('SUA_SUPABASE')) {
    return null;
  }
  return { url, anonKey };
}

export async function verifySupabaseJwt(token: string): Promise<AuthContext | null> {
  const cfg = getSupabaseServerConfig();
  if (!cfg) return null;

  const client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) {
    return null;
  }

  return {
    userId: data.user.id,
    email: data.user.email || '',
    isDemo: false,
    accessToken: token,
    supabase: client,
  };
}

export function createAuthMiddleware(customVerifier?: TokenVerifier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const isDemoHeader = req.headers['x-aconchego-demo'] === 'true';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Autenticação necessária. Entre na sua conta para utilizar este recurso.',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        error: 'Token de sessão inválido ou ausente.',
      });
    }

    // Modo demonstração explícito: nunca acessa banco de usuários reais
    if (isDemoHeader && token === 'demo-session') {
      if (process.env.ENABLE_DEMO_AI !== 'true') {
        return res.status(403).json({
          error: 'Entre na sua conta para usar o scanner e o Assistente IA.',
        });
      }
      (req as AuthenticatedRequest).auth = {
        userId: 'demo-user',
        email: 'demo@aconchego.local',
        isDemo: true,
        accessToken: token,
        supabase: null,
      };
      return next();
    }

    try {
      const verifier = customVerifier || verifySupabaseJwt;
      const verified = await verifier(token);
      if (!verified) {
        return res.status(401).json({
          error: 'Sessão expirada ou inválida. Faça login novamente.',
        });
      }

      (req as AuthenticatedRequest).auth = verified;
      return next();
    } catch {
      console.error('Erro na verificação de sessão.');
      return res.status(401).json({
        error: 'Não foi possível validar sua sessão.',
      });
    }
  };
}
