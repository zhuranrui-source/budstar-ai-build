import {
  readPublicRateLimitConfig,
  resolvePublicRateLimitStoreMode,
} from './public-rate-limit.config';

describe('public rate-limit configuration', () => {
  it('defaults production to Prisma and local/test to memory', () => {
    expect(resolvePublicRateLimitStoreMode({}, 'production')).toBe('prisma');
    expect(resolvePublicRateLimitStoreMode({}, 'test')).toBe('memory');
  });

  it('refuses an in-memory production limiter', () => {
    expect(() =>
      resolvePublicRateLimitStoreMode(
        { APPOINTMENT_RATE_LIMIT_STORE: 'memory' },
        'production',
      ),
    ).toThrow('must not use memory in production');
  });

  it('uses positive integer limits and rejects unsafe configuration', () => {
    expect(
      readPublicRateLimitConfig({
        APPOINTMENT_RATE_LIMIT_MAX: '3',
        APPOINTMENT_RATE_LIMIT_WINDOW_MS: '30000',
      }),
    ).toEqual({ max: 3, windowMs: 30_000 });
    expect(() =>
      readPublicRateLimitConfig({ APPOINTMENT_RATE_LIMIT_MAX: '0' }),
    ).toThrow('APPOINTMENT_RATE_LIMIT_MAX');
  });
});
