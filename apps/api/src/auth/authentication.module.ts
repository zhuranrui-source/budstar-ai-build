import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { resolveAuthenticationAdapters } from './authentication-boundaries';
import {
  AUTHENTICATION_SESSION_REPOSITORY,
  InMemoryAuthenticationSessionRepository,
  PrismaAuthenticationSessionRepository,
} from './authentication-session.repository';
import {
  AUTHENTICATION_STATE_REPOSITORY,
  InMemoryAuthenticationStateRepository,
  PrismaAuthenticationStateRepository,
} from './authentication-state.repository';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { AUTHENTICATION_ADAPTERS } from './authentication.tokens';
import {
  createProductionAuthenticationAdapters,
  productionAuthenticationAdapterConfig,
} from './production-authentication-adapters';

@Module({
  imports: [AuditModule, DatabaseModule],
  controllers: [AuthenticationController],
  providers: [
    {
      provide: AUTHENTICATION_ADAPTERS,
      useFactory: (prisma: PrismaService) =>
        process.env.NODE_ENV === 'production'
          ? createProductionAuthenticationAdapters(
              prisma,
              productionAuthenticationAdapterConfig(process.env),
            )
          : resolveAuthenticationAdapters({
              nodeEnv: process.env.NODE_ENV,
              verificationAdapter: undefined,
            }),
      inject: [PrismaService],
    },
    InMemoryAuthenticationSessionRepository,
    PrismaAuthenticationSessionRepository,
    InMemoryAuthenticationStateRepository,
    PrismaAuthenticationStateRepository,
    {
      provide: AUTHENTICATION_SESSION_REPOSITORY,
      useFactory: (
        memory: InMemoryAuthenticationSessionRepository,
        prisma: PrismaAuthenticationSessionRepository,
      ) => (process.env.NODE_ENV === 'production' ? prisma : memory),
      inject: [
        InMemoryAuthenticationSessionRepository,
        PrismaAuthenticationSessionRepository,
      ],
    },
    {
      provide: AUTHENTICATION_STATE_REPOSITORY,
      useFactory: (
        memory: InMemoryAuthenticationStateRepository,
        prisma: PrismaAuthenticationStateRepository,
      ) => (process.env.NODE_ENV === 'production' ? prisma : memory),
      inject: [
        InMemoryAuthenticationStateRepository,
        PrismaAuthenticationStateRepository,
      ],
    },
    AuthenticationService,
  ],
  exports: [AUTHENTICATION_ADAPTERS, AuthenticationService],
})
export class AuthenticationModule {}

export { AUTHENTICATION_ADAPTERS } from './authentication.tokens';
