import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

export type StoredRefreshToken = {
  id: string;
  sessionId: string;
  familyId: string;
  accountId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
};

export type RotateRefreshTokenResult =
  | { status: 'rotated'; accountId: string; sessionId: string }
  | { status: 'reused' }
  | { status: 'invalid' };

export interface AuthenticationSessionRepository {
  create(input: {
    sessionId: string;
    familyId: string;
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
    auditLogin?: boolean;
  }): Promise<void>;
  rotate(
    oldTokenHash: string,
    replacement: {
      id: string;
      tokenHash: string;
      expiresAt: Date;
    },
    now: Date,
  ): Promise<RotateRefreshTokenResult>;
  isActive(sessionId: string, accountId: string, now: Date): Promise<boolean>;
  revokeSession(sessionId: string, now: Date): Promise<void>;
  revokeByRefreshToken(
    tokenHash: string,
    now: Date,
  ): Promise<'revoked' | 'invalid'>;
}

export const AUTHENTICATION_SESSION_REPOSITORY = Symbol(
  'AUTHENTICATION_SESSION_REPOSITORY',
);

@Injectable()
export class InMemoryAuthenticationSessionRepository implements AuthenticationSessionRepository {
  private readonly records = new Map<string, StoredRefreshToken>();

  create(input: {
    sessionId: string;
    familyId: string;
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
    auditLogin?: boolean;
  }): Promise<void> {
    this.records.set(input.tokenHash, {
      id: randomUUID(),
      ...input,
      revokedAt: null,
      replacedById: null,
    });
    return Promise.resolve();
  }

  rotate(
    oldTokenHash: string,
    replacement: { id: string; tokenHash: string; expiresAt: Date },
    now: Date,
  ): Promise<RotateRefreshTokenResult> {
    const current = this.records.get(oldTokenHash);
    if (!current) {
      return Promise.resolve({ status: 'invalid' });
    }
    if (current.revokedAt || current.replacedById) {
      this.revokeFamily(current.familyId, now);
      return Promise.resolve({ status: 'reused' });
    }
    if (current.expiresAt <= now) {
      return Promise.resolve({ status: 'invalid' });
    }
    current.revokedAt = now;
    current.replacedById = replacement.id;
    this.records.set(replacement.tokenHash, {
      id: replacement.id,
      sessionId: current.sessionId,
      familyId: current.familyId,
      accountId: current.accountId,
      tokenHash: replacement.tokenHash,
      expiresAt: replacement.expiresAt,
      revokedAt: null,
      replacedById: null,
    });
    return Promise.resolve({
      status: 'rotated',
      accountId: current.accountId,
      sessionId: current.sessionId,
    });
  }

  isActive(sessionId: string, accountId: string, now: Date): Promise<boolean> {
    return Promise.resolve(
      [...this.records.values()].some(
        (record) =>
          record.sessionId === sessionId &&
          record.accountId === accountId &&
          !record.revokedAt &&
          record.expiresAt > now,
      ),
    );
  }

  revokeSession(sessionId: string, now: Date): Promise<void> {
    for (const record of this.records.values()) {
      if (record.sessionId === sessionId && !record.revokedAt) {
        record.revokedAt = now;
      }
    }
    return Promise.resolve();
  }

  revokeByRefreshToken(
    tokenHash: string,
    now: Date,
  ): Promise<'revoked' | 'invalid'> {
    const current = this.records.get(tokenHash);
    if (!current) return Promise.resolve('invalid');
    this.revokeFamily(current.familyId, now);
    return Promise.resolve('revoked');
  }

  private revokeFamily(familyId: string, now: Date): void {
    for (const record of this.records.values()) {
      if (record.familyId === familyId && !record.revokedAt) {
        record.revokedAt = now;
      }
    }
  }
}

@Injectable()
export class PrismaAuthenticationSessionRepository implements AuthenticationSessionRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: {
    sessionId: string;
    familyId: string;
    accountId: string;
    tokenHash: string;
    expiresAt: Date;
    auditLogin?: boolean;
  }): Promise<void> {
    await this.prisma.client.$transaction(async (transaction) => {
      await transaction.authenticationSession.create({
        data: {
          sessionId: input.sessionId,
          familyId: input.familyId,
          userAccountId: input.accountId,
          refreshTokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      });
      if (input.auditLogin) {
        await transaction.auditEvent.create({
          data: {
            actorAccountId: input.accountId,
            action: 'AUTH_LOGIN_SUCCEEDED',
          },
        });
      }
    });
  }

  async rotate(
    oldTokenHash: string,
    replacement: { id: string; tokenHash: string; expiresAt: Date },
    now: Date,
    retryCount = 0,
  ): Promise<RotateRefreshTokenResult> {
    try {
      return await this.prisma.client.$transaction(
        async (transaction) => {
          const current = await transaction.authenticationSession.findUnique({
            where: { refreshTokenHash: oldTokenHash },
          });
          if (!current) return { status: 'invalid' };
          if (current.revokedAt || current.replacedById) {
            await transaction.authenticationSession.updateMany({
              where: { familyId: current.familyId, revokedAt: null },
              data: { revokedAt: now },
            });
            return { status: 'reused' };
          }
          if (current.expiresAt <= now) return { status: 'invalid' };
          const consumed = await transaction.authenticationSession.updateMany({
            where: {
              id: current.id,
              revokedAt: null,
              replacedById: null,
            },
            data: { revokedAt: now, replacedById: replacement.id },
          });
          if (consumed.count !== 1) {
            await transaction.authenticationSession.updateMany({
              where: { familyId: current.familyId, revokedAt: null },
              data: { revokedAt: now },
            });
            return { status: 'reused' };
          }
          await transaction.authenticationSession.create({
            data: {
              id: replacement.id,
              sessionId: current.sessionId,
              familyId: current.familyId,
              userAccountId: current.userAccountId,
              refreshTokenHash: replacement.tokenHash,
              expiresAt: replacement.expiresAt,
            },
          });
          return {
            status: 'rotated',
            accountId: current.userAccountId,
            sessionId: current.sessionId,
          };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      const caught = error as unknown;
      if (
        retryCount < 2 &&
        typeof caught === 'object' &&
        caught !== null &&
        'code' in caught &&
        this.errorCode(caught) === 'P2034'
      ) {
        return this.rotate(oldTokenHash, replacement, now, retryCount + 1);
      }
      throw error;
    }
  }

  private errorCode(error: object): unknown {
    return Reflect.get(error, 'code') as unknown;
  }

  async isActive(
    sessionId: string,
    accountId: string,
    now: Date,
  ): Promise<boolean> {
    return (
      (await this.prisma.client.authenticationSession.count({
        where: {
          sessionId,
          userAccountId: accountId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
      })) > 0
    );
  }

  async revokeSession(sessionId: string, now: Date): Promise<void> {
    await this.prisma.client.authenticationSession.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: now },
    });
  }

  async revokeByRefreshToken(
    tokenHash: string,
    now: Date,
  ): Promise<'revoked' | 'invalid'> {
    return this.prisma.client.$transaction(async (transaction) => {
      const current = await transaction.authenticationSession.findUnique({
        where: { refreshTokenHash: tokenHash },
      });
      if (!current) return 'invalid';
      await transaction.authenticationSession.updateMany({
        where: { familyId: current.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      return 'revoked';
    });
  }
}
