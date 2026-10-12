import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { ApiException } from '../http/api-error';

export type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export type PublicRateLimitDecision = RateLimitBucket & {
  allowed: boolean;
};

export interface PublicRateLimitStore {
  consume(
    keyHash: string,
    now: number,
    windowMs: number,
    max: number,
  ): Promise<PublicRateLimitDecision>;
}

export const PUBLIC_RATE_LIMIT_STORE = Symbol('PUBLIC_RATE_LIMIT_STORE');
export const PUBLIC_RATE_LIMIT_CLOCK = Symbol('PUBLIC_RATE_LIMIT_CLOCK');
export const PUBLIC_RATE_LIMIT_CONFIG = Symbol('PUBLIC_RATE_LIMIT_CONFIG');

export type PublicRateLimitConfig = {
  windowMs: number;
  max: number;
};

export class InMemoryPublicRateLimitStore implements PublicRateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(
    keyHash: string,
    now: number,
    windowMs: number,
    max: number,
  ): Promise<PublicRateLimitDecision> {
    const current = this.buckets.get(keyHash);
    const bucket =
      current && current.resetAt > now
        ? current
        : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    this.buckets.set(keyHash, bucket);

    return Promise.resolve({ ...bucket, allowed: bucket.count <= max });
  }

  hasRawKey(rawKey: string): boolean {
    return this.buckets.has(rawKey);
  }
}

@Injectable()
export class PublicAppointmentRateLimitGuard implements CanActivate {
  constructor(
    @Inject(PUBLIC_RATE_LIMIT_STORE)
    private readonly store: PublicRateLimitStore,
    @Inject(PUBLIC_RATE_LIMIT_CLOCK)
    private readonly now: () => number,
    @Inject(PUBLIC_RATE_LIMIT_CONFIG)
    private readonly config: PublicRateLimitConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = this.now();
    const clientAddress =
      request.ip || request.socket.remoteAddress || 'unknown';
    const keyHash = createHash('sha256').update(clientAddress).digest('hex');
    const decision = await this.store.consume(
      keyHash,
      now,
      this.config.windowMs,
      this.config.max,
    );
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, this.config.max - decision.count)),
    );

    if (!decision.allowed) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((decision.resetAt - now) / 1000))),
      );
      throw new ApiException(
        HttpStatus.TOO_MANY_REQUESTS,
        'RATE_LIMITED',
        '请求过于频繁，请稍后再试',
      );
    }

    return true;
  }
}
