import { HttpStatus } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import {
  InMemoryPublicRateLimitStore,
  PublicAppointmentRateLimitGuard,
} from './public-appointment-rate-limit.guard';

describe('PublicAppointmentRateLimitGuard', () => {
  it('deterministically limits requests by a non-reversible client key', async () => {
    const headers = new Map<string, string>();
    const store = new InMemoryPublicRateLimitStore();
    const guard = new PublicAppointmentRateLimitGuard(store, () => 1_000, {
      max: 2,
      windowMs: 60_000,
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.10',
          socket: {},
        }),
        getResponse: () => ({
          setHeader: (name: string, value: string) => headers.set(name, value),
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(headers.get('Retry-After')).toBe('60');
    expect(store.hasRawKey('203.0.113.10')).toBe(false);
  });
});
