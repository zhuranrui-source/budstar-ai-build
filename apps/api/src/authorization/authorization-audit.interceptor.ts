import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, concatMap, from, map, Observable, of } from 'rxjs';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from './authenticated-request';
import { AUDITED_WRITE } from './authorization.decorators';

@Injectable()
export class AuthorizationAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const resourceType = this.reflector.getAllAndOverride<string>(
      AUDITED_WRITE,
      [context.getHandler(), context.getClass()],
    );
    if (!resourceType) return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return next.handle().pipe(
      concatMap((value: unknown) =>
        from(
          this.audit.record({
            actorAccountId: request.authorizationActor?.userAccountId,
            action: 'AUTHORIZED_BUSINESS_WRITE',
            campusId: request.campusId,
            resourceType,
          }),
        ).pipe(
          map((): unknown => value),
          catchError(() => of(value)),
        ),
      ),
    );
  }
}
