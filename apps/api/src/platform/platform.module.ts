import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { PlatformAdminController } from './platform-admin.controller';
import {
  InMemoryPlatformDataStore,
  PlatformAdminService,
  type PlatformDataStore,
} from './platform-admin.service';
import { PrismaPlatformDataStore } from './prisma-platform-data.store';

export const PLATFORM_DATA_STORE = Symbol('PLATFORM_DATA_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformAdminController],
  providers: [
    {
      provide: PLATFORM_DATA_STORE,
      useFactory: (prisma: PrismaService): PlatformDataStore => {
        if (process.env.PLATFORM_DATA_STORE === 'memory') {
          return new InMemoryPlatformDataStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for platform data browser in production',
            );
          }
          return new InMemoryPlatformDataStore();
        }
        return new PrismaPlatformDataStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: PlatformAdminService,
      useFactory: (store: PlatformDataStore) => new PlatformAdminService(store),
      inject: [PLATFORM_DATA_STORE],
    },
  ],
})
export class PlatformModule {}
