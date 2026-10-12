import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type ChallengeAttempt =
  | { status: 'valid'; accountId: string }
  | { status: 'invalid' }
  | { status: 'rate-limited' };

export interface AuthenticationStateRepository {
  consumeRateLimit(
    keyHash: string,
    now: Date,
    windowMs: number,
    maximum: number,
  ): Promise<boolean>;
  createChallenge(input: {
    tokenHash: string;
    accountId: string;
    intendedKind: 'staff' | 'partner' | 'platform-admin';
    expiresAt: Date;
  }): Promise<void>;
  attemptChallenge(
    tokenHash: string,
    intendedKind: 'staff' | 'partner' | 'platform-admin',
    now: Date,
    maximum: number,
  ): Promise<ChallengeAttempt>;
  completeChallenge(tokenHash: string): Promise<void>;
}

export const AUTHENTICATION_STATE_REPOSITORY = Symbol(
  'AUTHENTICATION_STATE_REPOSITORY',
);

@Injectable()
export class InMemoryAuthenticationStateRepository implements AuthenticationStateRepository {
  private readonly rateLimits = new Map<
    string,
    { count: number; resetAt: Date }
  >();
  private readonly challenges = new Map<
    string,
    {
      accountId: string;
      intendedKind: 'staff' | 'partner' | 'platform-admin';
      expiresAt: Date;
      attempts: number;
    }
  >();

  consumeRateLimit(
    keyHash: string,
    now: Date,
    windowMs: number,
    maximum: number,
  ): Promise<boolean> {
    const current = this.rateLimits.get(keyHash);
    if (!current || current.resetAt <= now) {
      this.rateLimits.set(keyHash, {
        count: 1,
        resetAt: new Date(now.getTime() + windowMs),
      });
      return Promise.resolve(true);
    }
    current.count += 1;
    return Promise.resolve(current.count <= maximum);
  }

  createChallenge(input: {
    tokenHash: string;
    accountId: string;
    intendedKind: 'staff' | 'partner' | 'platform-admin';
    expiresAt: Date;
  }): Promise<void> {
    this.challenges.set(input.tokenHash, { ...input, attempts: 0 });
    return Promise.resolve();
  }

  attemptChallenge(
    tokenHash: string,
    intendedKind: 'staff' | 'partner' | 'platform-admin',
    now: Date,
    maximum: number,
  ): Promise<ChallengeAttempt> {
    const challenge = this.challenges.get(tokenHash);
    if (
      !challenge ||
      challenge.expiresAt <= now ||
      challenge.intendedKind !== intendedKind
    ) {
      return Promise.resolve({ status: 'invalid' });
    }
    challenge.attempts += 1;
    if (challenge.attempts > maximum) {
      this.challenges.delete(tokenHash);
      return Promise.resolve({ status: 'rate-limited' });
    }
    return Promise.resolve({ status: 'valid', accountId: challenge.accountId });
  }

  completeChallenge(tokenHash: string): Promise<void> {
    this.challenges.delete(tokenHash);
    return Promise.resolve();
  }
}

@Injectable()
export class PrismaAuthenticationStateRepository implements AuthenticationStateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consumeRateLimit(
    keyHash: string,
    now: Date,
    windowMs: number,
    maximum: number,
  ): Promise<boolean> {
    return this.retryTransaction(async () => {
      const resetAt = new Date(now.getTime() + windowMs);
      return this.prisma.client.$transaction(
        async (transaction) => {
          const existing =
            await transaction.authenticationRateLimitBucket.findUnique({
              where: { keyHash },
            });
          const bucket =
            !existing || existing.resetAt <= now
              ? await transaction.authenticationRateLimitBucket.upsert({
                  where: { keyHash },
                  create: { keyHash, count: 1, resetAt },
                  update: { count: 1, resetAt },
                })
              : await transaction.authenticationRateLimitBucket.update({
                  where: { keyHash },
                  data: { count: { increment: 1 } },
                });
          return bucket.count <= maximum;
        },
        { isolationLevel: 'Serializable' },
      );
    });
  }

  async createChallenge(input: {
    tokenHash: string;
    accountId: string;
    intendedKind: 'staff' | 'partner' | 'platform-admin';
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.client.authenticationChallenge.create({ data: input });
  }

  async attemptChallenge(
    tokenHash: string,
    intendedKind: 'staff' | 'partner' | 'platform-admin',
    now: Date,
    maximum: number,
  ): Promise<ChallengeAttempt> {
    return this.retryTransaction(() =>
      this.prisma.client.$transaction(
        async (transaction) => {
          const challenge =
            await transaction.authenticationChallenge.findUnique({
              where: { tokenHash },
            });
          if (
            !challenge ||
            challenge.expiresAt <= now ||
            challenge.intendedKind !== intendedKind
          ) {
            return { status: 'invalid' };
          }
          const updated = await transaction.authenticationChallenge.update({
            where: { tokenHash },
            data: { attempts: { increment: 1 } },
          });
          if (updated.attempts > maximum) {
            await transaction.authenticationChallenge.delete({
              where: { tokenHash },
            });
            return { status: 'rate-limited' };
          }
          return { status: 'valid', accountId: updated.accountId };
        },
        { isolationLevel: 'Serializable' },
      ),
    );
  }

  async completeChallenge(tokenHash: string): Promise<void> {
    await this.prisma.client.authenticationChallenge.deleteMany({
      where: { tokenHash },
    });
  }

  private async retryTransaction<T>(action: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await action();
      } catch (error) {
        if (attempt >= 2 || !isRetryableConflict(error)) throw error;
      }
    }
  }
}

function isRetryableConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}
