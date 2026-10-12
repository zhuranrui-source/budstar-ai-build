import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AuthenticationModule } from '../auth/authentication.module';
import { AuthorizationController } from './authorization.controller';
import { AuthorizationAuditInterceptor } from './authorization-audit.interceptor';
import { CampusAuthorizationGuard } from './campus-authorization.guard';
import { CampusAuthorizationPolicy } from './campus-authorization.policy';

@Module({
  imports: [AuthenticationModule, AuditModule],
  controllers: [AuthorizationController],
  providers: [
    CampusAuthorizationPolicy,
    CampusAuthorizationGuard,
    AuthorizationAuditInterceptor,
    {
      provide: APP_GUARD,
      useExisting: CampusAuthorizationGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuthorizationAuditInterceptor,
    },
  ],
})
export class AuthorizationModule {}
