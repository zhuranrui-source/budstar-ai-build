import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FamilyModule } from '../family/family.module';
import { FamilyService } from '../family/family.service';
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
  imports: [DatabaseModule, FamilyModule],
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
      // ADR-0008：公开流（CLASS/CAMPUS）创建时强制监护人展示授权
      useFactory: (store: CommunityStore, family: FamilyService) =>
        new CommunityService(store, family),
      inject: [COMMUNITY_STORE, FamilyService],
    },
  ],
  exports: [CommunityService],
})
export class CommunityModule {}
