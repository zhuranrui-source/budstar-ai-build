import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { PrismaService } from '../database/prisma.service';
import { CrmLeadsController } from './crm-leads.controller';
import {
  CrmLeadsService,
  InMemoryCrmLeadStore,
  type CrmLeadStore,
} from './crm-leads.service';
import { PrismaCrmLeadStore } from './prisma-crm-lead.store';

export const CRM_LEAD_STORE = Symbol('CRM_LEAD_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [CrmLeadsController],
  providers: [
    {
      provide: CRM_LEAD_STORE,
      useFactory: (prisma: PrismaService): CrmLeadStore => {
        if (process.env.CRM_LEAD_STORE === 'memory') {
          return new InMemoryCrmLeadStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for CRM lead persistence in production',
            );
          }
          return new InMemoryCrmLeadStore();
        }
        return new PrismaCrmLeadStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: CrmLeadsService,
      useFactory: (store: CrmLeadStore) => new CrmLeadsService(store),
      inject: [CRM_LEAD_STORE],
    },
  ],
  exports: [CrmLeadsService],
})
export class CrmModule {}
