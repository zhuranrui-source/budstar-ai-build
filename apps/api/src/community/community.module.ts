import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  AdminCommunityController,
  FamilyPlanetController,
  StudentPlanetController,
} from './community.controller';
import {
  CommunityService,
  InMemoryCommunityStore,
  type CommunityStore,
} from './community.service';
import { PrismaCommunityStore } from './prisma-community.store';

export const COMMUNITY_STORE = Symbol('COMMUNITY_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [
    AdminCommunityController,
    FamilyPlanetController,
    StudentPlanetController,
  ],
  providers: [
    {
      provide: COMMUNITY_STORE,
      useFactory: (prisma: PrismaService): CommunityStore => {
        if (process.env.COMMUNITY_STORE === 'memory') {
          return new InMemoryCommunityStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for community persistence in production',
            );
          }
          return new InMemoryCommunityStore();
        }
        return new PrismaCommunityStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: CommunityService,
      useFactory: (store: CommunityStore) => new CommunityService(store),
      inject: [COMMUNITY_STORE],
    },
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
