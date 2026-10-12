import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  AdminFeedbackController,
  AdminGrowthController,
  FamilyGrowthController,
  StudentGrowthController,
} from './feedback.controller';
import {
  FeedbackService,
  InMemoryFeedbackStore,
  type FeedbackStore,
} from './feedback.service';
import { PrismaFeedbackStore } from './prisma-feedback.store';

export const FEEDBACK_STORE = Symbol('FEEDBACK_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminFeedbackController,
    AdminGrowthController,
    StudentGrowthController,
    FamilyGrowthController,
  ],
  providers: [
    {
      provide: FEEDBACK_STORE,
      useFactory: (prisma: PrismaService): FeedbackStore => {
        if (process.env.FEEDBACK_STORE === 'memory') {
          return new InMemoryFeedbackStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for feedback persistence in production',
            );
          }
          return new InMemoryFeedbackStore();
        }
        return new PrismaFeedbackStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: FeedbackService,
      useFactory: (store: FeedbackStore) => new FeedbackService(store),
      inject: [FEEDBACK_STORE],
    },
  ],
  exports: [FeedbackService],
})
export class FeedbackModule {}
