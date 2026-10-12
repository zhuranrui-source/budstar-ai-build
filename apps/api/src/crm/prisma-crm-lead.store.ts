import { Injectable } from '@nestjs/common';
import type {
  AppointmentLeadStatus,
  ListAppointmentLeadsQuery,
} from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  CrmEnrollmentRecord,
  CrmLeadRecord,
  CrmLeadStore,
  CrmStatusHistoryRecord,
} from './crm-leads.service';

@Injectable()
export class PrismaCrmLeadStore implements CrmLeadStore {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    campusId: string,
    query: ListAppointmentLeadsQuery,
  ): Promise<CrmLeadRecord[]> {
    const rows = await this.prisma.client.appointmentLead.findMany({
      where: {
        campusId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.assigneeAccountId
          ? { assigneeAccountId: query.assigneeAccountId }
          : {}),
        ...(query.q
          ? {
              OR: [
                { parentName: { contains: query.q, mode: 'insensitive' } },
                {
                  interestedCourse: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapLead(row));
  }

  async findById(id: string): Promise<CrmLeadRecord | null> {
    const row = await this.prisma.client.appointmentLead.findUnique({
      where: { id },
    });
    return row ? this.mapLead(row) : null;
  }

  async save(lead: CrmLeadRecord): Promise<CrmLeadRecord> {
    const row = await this.prisma.client.appointmentLead.update({
      where: { id: lead.id },
      data: {
        status: lead.status,
        assigneeAccountId: lead.assigneeAccountId,
        note: lead.note,
        updatedAt: lead.updatedAt,
      },
    });
    return this.mapLead(row);
  }

  async listHistory(leadId: string): Promise<CrmStatusHistoryRecord[]> {
    const rows = await this.prisma.client.appointmentLeadStatusHistory.findMany(
      {
        where: { appointmentLeadId: leadId },
        orderBy: { changedAt: 'asc' },
      },
    );
    return rows.map((row) => ({
      id: row.id,
      campusId: row.campusId,
      appointmentLeadId: row.appointmentLeadId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      changedByAccountId: row.changedByAccountId,
      changedAt: row.changedAt,
      note: row.note,
    }));
  }

  async appendHistory(
    history: CrmStatusHistoryRecord,
  ): Promise<CrmStatusHistoryRecord> {
    const row = await this.prisma.client.appointmentLeadStatusHistory.create({
      data: {
        id: history.id,
        campusId: history.campusId,
        appointmentLeadId: history.appointmentLeadId,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        changedByAccountId: history.changedByAccountId,
        changedAt: history.changedAt,
        note: history.note,
      },
    });
    return {
      id: row.id,
      campusId: row.campusId,
      appointmentLeadId: row.appointmentLeadId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      changedByAccountId: row.changedByAccountId,
      changedAt: row.changedAt,
      note: row.note,
    };
  }

  async findEnrollment(
    appointmentLeadId: string,
  ): Promise<CrmEnrollmentRecord | null> {
    const row = await this.prisma.client.enrollmentRecord.findUnique({
      where: { appointmentLeadId },
    });
    return row
      ? {
          id: row.id,
          campusId: row.campusId,
          appointmentLeadId: row.appointmentLeadId,
          classId: row.classId,
          enrolledAt: row.enrolledAt,
          note: row.note,
          createdByAccountId: row.createdByAccountId,
        }
      : null;
  }

  async saveEnrollment(
    record: CrmEnrollmentRecord,
  ): Promise<CrmEnrollmentRecord> {
    const row = await this.prisma.client.enrollmentRecord.create({
      data: {
        id: record.id,
        campusId: record.campusId,
        appointmentLeadId: record.appointmentLeadId,
        classId: record.classId,
        enrolledAt: record.enrolledAt,
        note: record.note,
        createdByAccountId: record.createdByAccountId,
      },
    });
    return {
      id: row.id,
      campusId: row.campusId,
      appointmentLeadId: row.appointmentLeadId,
      classId: row.classId,
      enrolledAt: row.enrolledAt,
      note: row.note,
      createdByAccountId: row.createdByAccountId,
    };
  }

  private mapLead(row: {
    id: string;
    campusId: string;
    parentName: string;
    phone: string;
    childAgeOrGrade: string;
    interestedCourse: string;
    preferredContactTime: string;
    status: AppointmentLeadStatus;
    assigneeAccountId: string | null;
    note: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CrmLeadRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      parentName: row.parentName,
      phone: row.phone,
      childAgeOrGrade: row.childAgeOrGrade,
      interestedCourse: row.interestedCourse,
      preferredContactTime: row.preferredContactTime,
      status: row.status,
      assigneeAccountId: row.assigneeAccountId,
      note: row.note,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
