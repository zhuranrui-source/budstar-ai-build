import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationService } from '../auth/authentication.service';
import { ApiException } from '../http/api-error';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from './authenticated-request';
import {
  CAMPUS_CAPABILITY,
  PLATFORM_CAPABILITY,
  PUBLIC_ROUTE,
} from './authorization.decorators';
import {
  CampusAuthorizationPolicy,
  type CampusCapability,
  type PlatformCapability,
} from './campus-authorization.policy';

@Injectable()
export class CampusAuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authentication: AuthenticationService,
    private readonly policy: CampusAuthorizationPolicy,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    const { actor, sessionId } = await this.authentication.authenticate(token);
    request.authorizationActor = actor;
    request.authenticationSessionId = sessionId;

    const campusCapability = this.reflector.getAllAndOverride<CampusCapability>(
      CAMPUS_CAPABILITY,
      [context.getHandler(), context.getClass()],
    );
    if (campusCapability) {
      const campusId = this.singleHeader(request.headers['x-campus-id']);
      if (
        !campusId ||
        !this.policy.canAccessCampus(actor, campusId, campusCapability)
      ) {
        await this.deny(actor.userAccountId, campusId);
      }
      request.campusId = campusId;
    }

    const platformCapability =
      this.reflector.getAllAndOverride<PlatformCapability>(
        PLATFORM_CAPABILITY,
        [context.getHandler(), context.getClass()],
      );
    if (
      platformCapability &&
      !this.policy.canGovernPlatform(actor, platformCapability)
    ) {
      await this.deny(actor.userAccountId);
    }
    return true;
  }

  private bearerToken(authorization: string | undefined): string {
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiException(401, 'UNAUTHORIZED', '请先完成身份验证');
    }
    return authorization.slice('Bearer '.length);
  }

  private singleHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private forbidden(): ApiException {
    return new ApiException(403, 'FORBIDDEN', '无权执行该操作');
  }

  private async deny(
    actorAccountId: string,
    campusId?: string,
  ): Promise<never> {
    await this.audit.record({
      actorAccountId,
      action: 'AUTHORIZATION_DENIED',
      campusId,
    });
    throw this.forbidden();
  }
}
