import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  APPOINTMENT_LEAD_REPOSITORY,
  InMemoryAppointmentLeadRepository,
} from './appointment-lead.repository';
import { resolveAppointmentLeadRepositoryMode } from './appointment-lead-repository.config';
import { AppointmentLeadsController } from './appointment-leads.controller';
import { AppointmentLeadsService } from './appointment-leads.service';
import { PrismaAppointmentLeadRepository } from './prisma-appointment-lead.repository';
import { PublicAppointmentRateLimitGuard } from './public-appointment-rate-limit.guard';
import {
  InMemoryPublicRateLimitStore,
  PUBLIC_RATE_LIMIT_CLOCK,
  PUBLIC_RATE_LIMIT_CONFIG,
  PUBLIC_RATE_LIMIT_STORE,
} from './public-appointment-rate-limit.guard';
import {
  readPublicRateLimitConfig,
  resolvePublicRateLimitStoreMode,
} from './public-rate-limit.config';
import { PrismaPublicRateLimitStore } from './prisma-public-rate-limit.store';

@Module({
  imports: [DatabaseModule],
  controllers: [AppointmentLeadsController],
  providers: [
    AppointmentLeadsService,
    PublicAppointmentRateLimitGuard,
    PrismaPublicRateLimitStore,
    {
      provide: PUBLIC_RATE_LIMIT_CLOCK,
      useValue: Date.now,
    },
    {
      provide: PUBLIC_RATE_LIMIT_CONFIG,
      useFactory: () => readPublicRateLimitConfig(process.env),
    },
    {
      provide: PUBLIC_RATE_LIMIT_STORE,
      inject: [PrismaPublicRateLimitStore],
      useFactory: (prismaStore: PrismaPublicRateLimitStore) =>
        resolvePublicRateLimitStoreMode(process.env) === 'memory'
          ? new InMemoryPublicRateLimitStore()
          : prismaStore,
    },
    {
      provide: APPOINTMENT_LEAD_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
        const mode = resolveAppointmentLeadRepositoryMode(
          process.env,
          process.env.NODE_ENV,
        );

        if (mode === 'memory') {
          return new InMemoryAppointmentLeadRepository();
        }

        return new PrismaAppointmentLeadRepository(prisma.client);
      },
    },
  ],
})
export class AppointmentLeadsModule {}
