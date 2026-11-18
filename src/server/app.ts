import express, { Express, Request, Response, NextFunction } from 'express';
import {
  AuthenticatedRequest,
  TokenVerifier,
  createAuthMiddleware,
} from './authMiddleware.js';
import { InMemoryServerFinanceStore, ServerFinanceStore, SupabaseServerFinanceStore } from './dataStore.js';
import { SlidingWindowRateLimiter, createRateLimitMiddleware } from './rateLimiter.js';
import {
  ScanReceiptDeps,
  ScannerHttpError,
  getConfiguredGeminiModel,
  scanReceiptImage,
} from './receiptScanner.js';
import { AgentChatDeps, AgentHttpError, runAgentChatTurn } from './agentService.js';
import { AgentConfirmRequestSchema } from './schemas.js';

export interface CreateApiAppOptions {
  verifyToken?: TokenVerifier;
  storeFactory?: (req: AuthenticatedRequest) => ServerFinanceStore;
  scannerDeps?: ScanReceiptDeps;
  agentDeps?: AgentChatDeps;
  disableRateLimit?: boolean;
}

function defaultStoreFactory(req: AuthenticatedRequest): ServerFinanceStore {
  if (!req.auth.isDemo && req.auth.supabase) {
    return new SupabaseServerFinanceStore(req.auth.supabase, req.auth.userId);
  }
  const demoState = req.body?.demoState as
    | {
        transactions?: any[];
        budgets?: any[];
        goals?: any[];
        importedHashes?: string[];
      }
    | undefined;
  return new InMemoryServerFinanceStore(
    req.auth.userId,
    demoState
      ? {
          transactions: Array.isArray(demoState.transactions) ? demoState.transactions : undefined,
          budgets: Array.isArray(demoState.budgets) ? demoState.budgets : undefined,
          goals: Array.isArray(demoState.goals) ? demoState.goals : undefined,
          receiptHashes: Array.isArray(demoState.importedHashes)
            ? demoState.importedHashes
            : undefined,
        }
      : undefined
  );
}

export function createApiApp(options: CreateApiAppOptions = {}): Express {
  const app = express();
  app.disable('x-powered-by');

  // Compatibilidade com runtimes serverless (ex: Vercel) que já fazem parse de req.body
  app.use((req, _res, next) => {
    if (req.body !== undefined && typeof req.body === 'object' && req.body !== null) {
      (req as Request & { _body?: boolean })._body = true;
    }
    next();
  });

  app.use(express.json({ limit: '12mb' }));
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Corpo JSON inválido.' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Arquivo ou requisição acima do limite permitido.' });
    }
    return next(err);
  });

  const authMiddleware = createAuthMiddleware(options.verifyToken);
  const resolveStore = options.storeFactory || defaultStoreFactory;

  const scanLimiter = new SlidingWindowRateLimiter(20, 60_000);
  const agentLimiter = new SlidingWindowRateLimiter(30, 60_000);
  const confirmLimiter = new SlidingWindowRateLimiter(40, 60_000);

  const maybeLimit = (limiter: SlidingWindowRateLimiter, scope: string) =>
    options.disableRateLimit
      ? (_req: Request, _res: Response, next: express.NextFunction) => next()
      : createRateLimitMiddleware(limiter, scope);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'aconchego-financas',
      geminiConfigured: Boolean((process.env.GEMINI_API_KEY || '').trim()),
      model: getConfiguredGeminiModel(),
      timestamp: new Date().toISOString(),
    });
  });

  app.post(
    '/api/receipts/scan',
    authMiddleware,
    maybeLimit(scanLimiter, 'leitura de recibos'),
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const store = resolveStore(authReq);
        const existingHashes = await store.getReceiptHashes();

        const result = await scanReceiptImage(req.body, {
          ...options.scannerDeps,
          isDuplicateHash: async (hash: string) => {
            if (options.scannerDeps?.isDuplicateHash) {
              return options.scannerDeps.isDuplicateHash(hash);
            }
            return existingHashes.includes(hash);
          },
        });

        return res.json(result);
      } catch (err: unknown) {
        if (err instanceof ScannerHttpError) {
          return res.status(err.statusCode).json({
            error: err.message,
            ...(err.details || {}),
          });
        }
        console.error('Erro inesperado no scanner.');
        return res.status(500).json({
          error: 'Erro interno ao processar comprovante.',
        });
      }
    }
  );

  app.post(
    '/api/agent/chat',
    authMiddleware,
    maybeLimit(agentLimiter, 'assistente financeiro'),
    async (req: Request, res: Response) => {
      try {
        const authReq = req as AuthenticatedRequest;
        const store = resolveStore(authReq);
        const result = await runAgentChatTurn(req.body, store, options.agentDeps);
        return res.json(result);
      } catch (err: unknown) {
        if (err instanceof AgentHttpError) {
          return res.status(err.statusCode).json({ error: err.message });
        }
        console.error('Erro no Assistente Financeiro.');
        return res.status(500).json({
          error: 'Não foi possível processar sua pergunta no momento.',
        });
      }
    }
  );

  app.post(
    '/api/agent/confirm',
    authMiddleware,
    maybeLimit(confirmLimiter, 'confirmação de operação'),
    async (req: Request, res: Response) => {
      const parsed = AgentConfirmRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Dados de confirmação inválidos.',
        });
      }

      try {
        const authReq = req as AuthenticatedRequest;
        const store = resolveStore(authReq);
        const result = await store.executeOrCancelOperation(
          parsed.data.operationId,
          parsed.data.action
        );

        if (result.conflict) {
          return res.status(409).json({
            error: result.conflict,
            operation: result.operation,
          });
        }

        return res.json({
          operation: result.operation,
          mutatedData: result.mutatedData,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Falha ao confirmar operação.';
        const status = message.includes('não encontrad') ? 404 : 400;
        return res.status(status).json({ error: message });
      }
    }
  );

  return app;
}
