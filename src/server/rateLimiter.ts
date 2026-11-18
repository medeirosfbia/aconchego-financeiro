import { NextFunction, Request, Response } from 'express';

interface BucketEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, BucketEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const entry = this.buckets.get(key) || { timestamps: [] };
    const cutoff = now - this.windowMs;
    const active = entry.timestamps.filter((t) => t > cutoff);

    if (active.length >= this.maxRequests) {
      const oldest = active[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      this.buckets.set(key, { timestamps: active });
      return { allowed: false, retryAfterSeconds };
    }

    active.push(now);
    this.buckets.set(key, { timestamps: active });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(): void {
    this.buckets.clear();
  }
}

export function createRateLimitMiddleware(
  limiter: SlidingWindowRateLimiter,
  scope: string
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as Request & { auth?: { userId?: string } }).auth?.userId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${scope}:${authUser || ip}`;
    const result = limiter.check(key);

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json({
        error: `Muitas solicitações para ${scope}. Aguarde ${result.retryAfterSeconds}s antes de tentar novamente.`,
      });
    }

    next();
  };
}
