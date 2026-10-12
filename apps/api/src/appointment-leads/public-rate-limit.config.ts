import type { PublicRateLimitConfig } from './public-appointment-rate-limit.guard';

export type PublicRateLimitStoreMode = 'memory' | 'prisma';

export function resolvePublicRateLimitStoreMode(
  environment: Record<string, string | undefined>,
  nodeEnv = environment.NODE_ENV,
): PublicRateLimitStoreMode {
  const configured = environment.APPOINTMENT_RATE_LIMIT_STORE;

  if (configured === 'memory' && nodeEnv === 'production') {
    throw new Error(
      'APPOINTMENT_RATE_LIMIT_STORE must not use memory in production',
    );
  }
  if (configured === 'memory' || configured === 'prisma') {
    return configured;
  }
  if (configured) {
    throw new Error(`Unsupported APPOINTMENT_RATE_LIMIT_STORE: ${configured}`);
  }

  return nodeEnv === 'production' ? 'prisma' : 'memory';
}

export function readPublicRateLimitConfig(
  environment: Record<string, string | undefined>,
): PublicRateLimitConfig {
  return {
    max: readPositiveInteger(
      'APPOINTMENT_RATE_LIMIT_MAX',
      environment.APPOINTMENT_RATE_LIMIT_MAX,
      5,
    ),
    windowMs: readPositiveInteger(
      'APPOINTMENT_RATE_LIMIT_WINDOW_MS',
      environment.APPOINTMENT_RATE_LIMIT_WINDOW_MS,
      60_000,
    ),
  };
}

function readPositiveInteger(
  name: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}
