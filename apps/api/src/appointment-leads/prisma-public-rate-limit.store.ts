import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  PublicRateLimitDecision,
  PublicRateLimitStore,
} from './public-appointment-rate-limit.guard';

@Injectable()
export class PrismaPublicRateLimitStore implements PublicRateLimitStore {
  constructor(private readonly prisma: PrismaService) {}

  async consume(
    keyHash: string,
    now: number,
    windowMs: number,
    max: number,
  ): Promise<PublicRateLimitDecision> {
    const nowDate = new Date(now);
    const resetAt = new Date(now + windowMs);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.client.$transaction(
          async (transaction) => {
            const existing = await transaction.publicRateLimitBucket.findUnique(
              {
                where: { keyHash },
              },
            );
            const bucket =
              !existing || existing.resetAt <= nowDate
                ? await transaction.publicRateLimitBucket.upsert({
                    where: { keyHash },
                    create: { keyHash, count: 1, resetAt },
                    update: { count: 1, resetAt },
                  })
                : await transaction.publicRateLimitBucket.update({
                    where: { keyHash },
                    data: { count: { increment: 1 } },
                  });

            return {
              count: bucket.count,
              resetAt: bucket.resetAt.getTime(),
              allowed: bucket.count <= max,
            };
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (attempt === 3 || !isRetryableConflict(error)) {
          throw error;
        }
      }
    }

    throw new Error('Rate limit transaction retry limit exceeded');
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
