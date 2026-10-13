import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  SUBMISSION_STORE,
  SubmissionsModule,
} from '../submissions/submissions.module';
import type { SubmissionStore } from '../submissions/submissions.service';
import {
  DegradedAiGatewayAdapter,
  MockAiGatewayAdapter,
  RemoteAiGatewayAdapter,
} from './ai-gateway.adapters';
import {
  resolveAiGatewayAdapter,
  type AiGatewayAdapter,
} from './ai-gateway.boundaries';
import { AI_GATEWAY_ADAPTER } from './ai-gateway.tokens';
import { AiTeacherController } from './ai-teacher.controller';
import {
  AiTeacherService,
  InMemoryAiTeacherStore,
  type AiTeacherStore,
} from './ai-teacher.service';
import { PrismaAiTeacherStore } from './prisma-ai-teacher.store';

export const AI_TEACHER_STORE = Symbol('AI_TEACHER_STORE');

@Module({
  imports: [DatabaseModule, SubmissionsModule],
  controllers: [AiTeacherController],
  providers: [
    {
      provide: AI_GATEWAY_ADAPTER,
      useFactory: () =>
        resolveAiGatewayAdapter(
          {
            nodeEnv: process.env.NODE_ENV,
            provider: process.env.AI_GATEWAY_PROVIDER,
            primaryApiKey: process.env.AI_PRIMARY_API_KEY,
            fallbackApiKey: process.env.AI_FALLBACK_API_KEY,
            primaryEndpoint: process.env.AI_PRIMARY_ENDPOINT,
            fallbackEndpoint: process.env.AI_FALLBACK_ENDPOINT,
          },
          {
            createMock: () => new MockAiGatewayAdapter(),
            createRemote: (config) => new RemoteAiGatewayAdapter(config),
            createDegraded: (reasons) => new DegradedAiGatewayAdapter(reasons),
          },
        ),
    },
    {
      provide: AI_TEACHER_STORE,
      useFactory: (prisma: PrismaService): AiTeacherStore => {
        if (process.env.AI_TEACHER_STORE === 'memory') {
          return new InMemoryAiTeacherStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for AI teacher persistence in production',
            );
          }
          return new InMemoryAiTeacherStore();
        }
        return new PrismaAiTeacherStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: AiTeacherService,
      useFactory: (
        gateway: AiGatewayAdapter,
        store: AiTeacherStore,
        submissionStore: SubmissionStore,
      ) => new AiTeacherService(gateway, store, submissionStore),
      inject: [AI_GATEWAY_ADAPTER, AI_TEACHER_STORE, SUBMISSION_STORE],
    },
  ],
  exports: [AiTeacherService, AI_GATEWAY_ADAPTER],
})
export class AiTeacherModule {}
