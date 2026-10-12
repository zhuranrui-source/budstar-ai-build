import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { PrismaSubmissionStore } from './prisma-submission.store';
import {
  AdminSubmissionsController,
  StudentLearningController,
} from './submissions.controller';
import {
  InMemorySubmissionStore,
  SubmissionsService,
  type SubmissionStore,
} from './submissions.service';

export const SUBMISSION_STORE = Symbol('SUBMISSION_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [StudentLearningController, AdminSubmissionsController],
  providers: [
    {
      provide: SUBMISSION_STORE,
      useFactory: (prisma: PrismaService): SubmissionStore => {
        if (process.env.SUBMISSION_STORE === 'memory') {
          return new InMemorySubmissionStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for submission persistence in production',
            );
          }
          return new InMemorySubmissionStore();
        }
        return new PrismaSubmissionStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: SubmissionsService,
      useFactory: (store: SubmissionStore) => new SubmissionsService(store),
      inject: [SUBMISSION_STORE],
    },
  ],
  exports: [SubmissionsService, SUBMISSION_STORE],
})
export class SubmissionsModule {}
