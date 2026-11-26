import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  AdminPlanetController,
  MemberPlanetController,
  PublicPlanetController,
} from './planet.controller';
import { PlanetMediaService } from './planet-media.service';
import { PlanetService } from './planet.service';
import {
  InMemoryPlanetStore,
  PLANET_STORE,
  type PlanetStore,
} from './planet.store';
import { PrismaPlanetStore } from './prisma-planet.store';

@Module({
  imports: [DatabaseModule],
  controllers: [
    PublicPlanetController,
    MemberPlanetController,
    AdminPlanetController,
  ],
  providers: [
    {
      provide: PLANET_STORE,
      useFactory: (prisma: PrismaService): PlanetStore => {
        if (process.env.PLANET_STORE === 'memory')
          return new InMemoryPlanetStore();
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for planet persistence in production',
            );
          }
          return new InMemoryPlanetStore();
        }
        return new PrismaPlanetStore(prisma);
      },
      inject: [PrismaService],
    },
    PlanetMediaService,
    PlanetService,
  ],
})
export class PlanetModule {}
