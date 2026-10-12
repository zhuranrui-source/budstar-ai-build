import { Module } from '@nestjs/common';
import { resolveAppointmentLeadRepositoryMode } from '../appointment-leads/appointment-lead-repository.config';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import {
  CAMPUS_REPOSITORY,
  type CampusRepository,
  InMemoryCampusRepository,
} from './campus.repository';
import { CampusesController } from './campuses.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [CampusesController],
  providers: [
    {
      provide: CAMPUS_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService): CampusRepository => {
        const mode = resolveAppointmentLeadRepositoryMode(process.env);
        if (mode === 'memory') {
          return new InMemoryCampusRepository();
        }

        return {
          listPublic: () =>
            prisma.client.campus.findMany({
              orderBy: { name: 'asc' },
              select: { id: true, name: true },
            }),
        };
      },
    },
  ],
})
export class CampusesModule {}
