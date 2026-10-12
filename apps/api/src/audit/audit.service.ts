import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type AuditAction =
  | 'AUTH_LOGIN_SUCCEEDED'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTHORIZATION_DENIED'
  | 'CAMPUS_CONTEXT_SELECTED'
  | 'AUTHORIZED_BUSINESS_WRITE';

export type AuditRecord = {
  actorAccountId?: string;
  action: AuditAction;
  campusId?: string;
  resourceType?: string;
  resourceId?: string;
  occurredAt: Date;
};

@Injectable()
export class AuditService {
  private readonly localRecords: AuditRecord[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async record(input: Omit<AuditRecord, 'occurredAt'>): Promise<void> {
    const record = { ...input, occurredAt: new Date() };
    if (process.env.NODE_ENV !== 'production') {
      this.localRecords.push(record);
      return;
    }
    await this.prisma.client.auditEvent.create({
      data: {
        actorAccountId: record.actorAccountId,
        action: record.action,
        campusId: record.campusId,
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        occurredAt: record.occurredAt,
      },
    });
  }

  async recordLocalLoginSuccess(
    input: Omit<AuditRecord, 'occurredAt' | 'action'>,
  ): Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    await this.record({ ...input, action: 'AUTH_LOGIN_SUCCEEDED' });
  }

  listForTesting(): readonly AuditRecord[] {
    return this.localRecords;
  }
}
