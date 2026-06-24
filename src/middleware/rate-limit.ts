import type { FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

const store = new Map<string, RateLimitEntry>();

const DEFAULT_OPTIONS: RateLimitOptions = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
};

function cleanupExpiredEntries(options: RateLimitOptions) {
  const now = Date.now();
  const maxAge = options.windowMs + options.lockoutMs;
  for (const [key, entry] of store.entries()) {
    if (now - entry.firstAttemptAt > maxAge) {
      store.delete(key);
    }
  }
}

setInterval(() => cleanupExpiredEntries(DEFAULT_OPTIONS), 60 * 60 * 1000);

export function createRateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async function rateLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const email = (request.body as { email?: string })?.email || 'unknown';
    const key = `rate_limit:${request.ip}:${email}`;
    const now = Date.now();
    let entry = store.get(key);

    if (!entry) {
      entry = { attempts: 0, firstAttemptAt: now, lockedUntil: null };
    }

    if (entry.lockedUntil && entry.lockedUntil > now) {
      const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
      reply.code(429).send({
        error: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(retryAfter / 60)} menit.`,
        retryAfter
      });
      return;
    }

    if (now - entry.firstAttemptAt > opts.windowMs) {
      entry = { attempts: 0, firstAttemptAt: now, lockedUntil: null };
    }

    entry.attempts++;

    if (entry.attempts >= opts.maxAttempts) {
      entry.lockedUntil = now + opts.lockoutMs;
    }

    store.set(key, entry);
  };
}

export function resetRateLimit(request: FastifyRequest, email: string) {
  const key = `rate_limit:${request.ip}:${email}`;
  store.delete(key);
}

export const rateLimitMiddleware = createRateLimitMiddleware();
