import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../auth/authentication.module';
import { AuthenticationService } from '../auth/authentication.service';
import { PARENT_BINDING_LOOKUP } from '../auth/parent-binding.lookup';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { AdminFamilyController } from './admin-family.controller';
import { SubmissionsModule } from '../submissions/submissions.module';
import { FamilyController } from './family.controller';
import {
  FamilyService,
  InMemoryFamilyStore,
  type FamilyStore,
  type ParentBindingSync,
} from './family.service';
import { PrismaFamilyStore } from './prisma-family.store';

export const FAMILY_STORE = Symbol('FAMILY_STORE');

@Module({
  imports: [DatabaseModule, AuthenticationModule, SubmissionsModule],
  controllers: [FamilyController, AdminFamilyController],
  providers: [
    {
      provide: FAMILY_STORE,
      useFactory: (prisma: PrismaService): FamilyStore => {
        if (process.env.FAMILY_STORE === 'memory') {
          return new InMemoryFamilyStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for family persistence in production',
            );
          }
          return new InMemoryFamilyStore();
        }
        return new PrismaFamilyStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: FamilyService,
      useFactory: (
        store: FamilyStore,
        authentication: AuthenticationService,
      ) => {
        const sync: ParentBindingSync = {
          syncActiveStudentBindings: (userAccountId, studentProfileIds) =>
            authentication.syncActiveStudentBindings(
              userAccountId,
              studentProfileIds,
            ),
        };
        return new FamilyService(store, sync);
      },
      inject: [FAMILY_STORE, AuthenticationService],
    },
    {
      provide: PARENT_BINDING_LOOKUP,
      useFactory: (family: FamilyService) => ({
        listActiveStudentIds: (parentProfileId: string) =>
          family.listActiveStudentIdsForParent(parentProfileId),
      }),
      inject: [FamilyService],
    },
  ],
  exports: [FamilyService, PARENT_BINDING_LOOKUP],
})
export class FamilyModule {}
