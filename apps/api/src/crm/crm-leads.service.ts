import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canTransitionAppointmentLead,
  requiresReopenReason,
  type AppointmentLeadListItem,
  type AppointmentLeadStatus,
  type AppointmentLeadStatusHistoryItem,
  type CreateEnrollmentRecordInput,
  type EnrollmentRecord,
  type ListAppointmentLeadsQuery,
  type TransitionAppointmentLeadInput,
  type UpdateAppointmentLeadInput,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import { maskPhone } from '../privacy/mask-phone';

export type CrmLeadRecord = {
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
  source: string | null;
  nextContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CrmStatusHistoryRecord = {
  id: string;
  campusId: string;
  appointmentLeadId: string;
  fromStatus: AppointmentLeadStatus | null;
  toStatus: AppointmentLeadStatus;
  changedByAccountId: string | null;
  changedAt: Date;
  note: string | null;
};

export type CrmEnrollmentRecord = {
  id: string;
  campusId: string;
  appointmentLeadId: string;
  classId: string | null;
  enrolledAt: Date;
  note: string | null;
  createdByAccountId: string | null;
};

export interface CrmLeadStore {
  list(
    campusId: string,
    query: ListAppointmentLeadsQuery,
  ): Promise<CrmLeadRecord[]>;
  findById(id: string): Promise<CrmLeadRecord | null>;
  save(lead: CrmLeadRecord): Promise<CrmLeadRecord>;
  listHistory(leadId: string): Promise<CrmStatusHistoryRecord[]>;
  appendHistory(
    history: CrmStatusHistoryRecord,
  ): Promise<CrmStatusHistoryRecord>;
  findEnrollment(
    appointmentLeadId: string,
  ): Promise<CrmEnrollmentRecord | null>;
  saveEnrollment(record: CrmEnrollmentRecord): Promise<CrmEnrollmentRecord>;
}

export class InMemoryCrmLeadStore implements CrmLeadStore {
  private readonly leads = new Map<string, CrmLeadRecord>();
  private readonly history = new Map<string, CrmStatusHistoryRecord[]>();
  private readonly enrollments = new Map<string, CrmEnrollmentRecord>();

  seed(lead: CrmLeadRecord): void {
    this.leads.set(lead.id, lead);
    this.history.set(lead.id, [
      {
        id: randomUUID(),
        campusId: lead.campusId,
        appointmentLeadId: lead.id,
        fromStatus: null,
        toStatus: lead.status,
        changedByAccountId: null,
        changedAt: lead.createdAt,
        note: null,
      },
    ]);
  }

  list(
    campusId: string,
    query: ListAppointmentLeadsQuery,
  ): Promise<CrmLeadRecord[]> {
    const records = [...this.leads.values()].filter((lead) => {
      if (lead.campusId !== campusId) return false;
      if (query.status && lead.status !== query.status) return false;
      if (
        query.assigneeAccountId &&
        lead.assigneeAccountId !== query.assigneeAccountId
      ) {
        return false;
      }
      if (query.q) {
        const needle = query.q.toLowerCase();
        const haystack =
          `${lead.parentName} ${lead.interestedCourse}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return Promise.resolve(
      records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    );
  }

  findById(id: string): Promise<CrmLeadRecord | null> {
    return Promise.resolve(this.leads.get(id) ?? null);
  }

  save(lead: CrmLeadRecord): Promise<CrmLeadRecord> {
    this.leads.set(lead.id, lead);
    return Promise.resolve(lead);
  }

  listHistory(leadId: string): Promise<CrmStatusHistoryRecord[]> {
    return Promise.resolve(this.history.get(leadId) ?? []);
  }

  appendHistory(
    history: CrmStatusHistoryRecord,
  ): Promise<CrmStatusHistoryRecord> {
    const existing = this.history.get(history.appointmentLeadId) ?? [];
    existing.push(history);
    this.history.set(history.appointmentLeadId, existing);
    return Promise.resolve(history);
  }

  findEnrollment(
    appointmentLeadId: string,
  ): Promise<CrmEnrollmentRecord | null> {
    return Promise.resolve(this.enrollments.get(appointmentLeadId) ?? null);
  }

  saveEnrollment(record: CrmEnrollmentRecord): Promise<CrmEnrollmentRecord> {
    this.enrollments.set(record.appointmentLeadId, record);
    return Promise.resolve(record);
  }
}

@Injectable()
export class CrmLeadsService {
  constructor(private readonly store: CrmLeadStore) {}

  async list(
    campusId: string,
    query: ListAppointmentLeadsQuery,
  ): Promise<AppointmentLeadListItem[]> {
    const now = new Date();
    const leads = await this.store.list(campusId, query);
    return leads
      .filter((lead) => !query.source || lead.source === query.source)
      .filter((lead) => {
        if (query.overdue === undefined) return true;
        const wantsOverdue = query.overdue === 'true';
        const isOverdue = Boolean(
          lead.nextContactAt && lead.nextContactAt <= now,
        );
        return wantsOverdue === isOverdue;
      })
      .map((lead) => this.toListItem(lead));
  }

  /**
   * 漏斗看板（ISSUE-09）：各阶段数量 + 逾期数 + 阶段间转化率。
   * 转化率口径：进入过某阶段的线索数 / 进入过前一阶段的线索数（基于状态历史）。
   */
  async funnel(campusId: string): Promise<{
    stages: Array<{
      status: string;
      count: number;
      overdue: number;
    }>;
    conversionRates: Array<{
      from: string;
      to: string;
      rate: number;
    }>;
  }> {
    const leads = await this.store.list(campusId, {});
    const now = new Date();
    const order = [
      'PENDING_CONTACT',
      'CONTACTED',
      'VISIT_SCHEDULED',
      'VISITED',
      'ENROLLED',
    ] as const;
    const countBy = new Map<string, number>();
    const overdueBy = new Map<string, number>();
    for (const status of order) countBy.set(status, 0);
    for (const lead of leads) {
      countBy.set(lead.status, (countBy.get(lead.status) ?? 0) + 1);
      if (
        lead.nextContactAt &&
        lead.nextContactAt <= now &&
        lead.status !== 'ENROLLED' &&
        lead.status !== 'CLOSED'
      ) {
        overdueBy.set(lead.status, (overdueBy.get(lead.status) ?? 0) + 1);
      }
    }
    // 转化率：用当前漏斗累计（简单口径：某阶段及之后所有阶段数量之和 / 全部）
    const total = leads.length;
    const conversionRates: Array<{ from: string; to: string; rate: number }> =
      [];
    for (let i = 1; i < order.length; i += 1) {
      const reached = order
        .slice(i)
        .reduce((sum, status) => sum + (countBy.get(status) ?? 0), 0);
      conversionRates.push({
        from: order[i - 1]!,
        to: order[i]!,
        rate: total === 0 ? 0 : Math.round((reached / total) * 100),
      });
    }
    return {
      stages: order.map((status) => ({
        status,
        count: countBy.get(status) ?? 0,
        overdue: overdueBy.get(status) ?? 0,
      })),
      conversionRates,
    };
  }

  async getHistory(
    campusId: string,
    leadId: string,
  ): Promise<AppointmentLeadStatusHistoryItem[]> {
    const lead = await this.requireCampusLead(campusId, leadId);
    const history = await this.store.listHistory(lead.id);
    return history.map((item) => ({
      id: item.id,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      changedByAccountId: item.changedByAccountId,
      changedAt: item.changedAt.toISOString(),
      note: item.note,
    }));
  }

  async update(
    campusId: string,
    leadId: string,
    input: UpdateAppointmentLeadInput,
  ): Promise<AppointmentLeadListItem> {
    const lead = await this.requireCampusLead(campusId, leadId);
    if (input.assigneeAccountId !== undefined) {
      lead.assigneeAccountId = input.assigneeAccountId;
    }
    if (input.note !== undefined) {
      lead.note = input.note;
    }
    if (input.source !== undefined) {
      lead.source = input.source;
    }
    if (input.nextContactAt !== undefined) {
      lead.nextContactAt = input.nextContactAt
        ? new Date(input.nextContactAt)
        : null;
    }
    lead.updatedAt = new Date();
    await this.store.save(lead);
    return this.toListItem(lead);
  }

  async transition(
    campusId: string,
    leadId: string,
    actorAccountId: string,
    input: TransitionAppointmentLeadInput,
  ): Promise<AppointmentLeadListItem> {
    const lead = await this.requireCampusLead(campusId, leadId);
    if (!canTransitionAppointmentLead(lead.status, input.toStatus)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '线索状态流转不合法',
      );
    }
    if (requiresReopenReason(lead.status, input.toStatus)) {
      if (!input.reopenReason?.trim()) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_ERROR',
          '关闭线索重开必须填写原因',
        );
      }
    }

    const fromStatus = lead.status;
    const changedAt = new Date();
    lead.status = input.toStatus;
    lead.updatedAt = changedAt;
    if (input.note !== undefined) {
      lead.note = input.note;
    }
    await this.store.save(lead);
    await this.store.appendHistory({
      id: randomUUID(),
      campusId,
      appointmentLeadId: lead.id,
      fromStatus,
      toStatus: input.toStatus,
      changedByAccountId: actorAccountId,
      changedAt,
      note:
        fromStatus === 'CLOSED'
          ? (input.reopenReason ?? input.note ?? null)
          : (input.note ?? null),
    });
    return this.toListItem(lead);
  }

  async enroll(
    campusId: string,
    leadId: string,
    actorAccountId: string,
    input: CreateEnrollmentRecordInput,
  ): Promise<EnrollmentRecord> {
    const lead = await this.requireCampusLead(campusId, leadId);
    if (lead.status !== 'ENROLLED' && lead.status !== 'VISITED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅已到访或已报名线索可写入报名记录',
      );
    }
    const existing = await this.store.findEnrollment(lead.id);
    if (existing) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '该线索已存在报名记录',
      );
    }
    if (lead.status === 'VISITED') {
      await this.transition(campusId, leadId, actorAccountId, {
        toStatus: 'ENROLLED',
        note: input.note,
      });
    }
    const record: CrmEnrollmentRecord = {
      id: randomUUID(),
      campusId,
      appointmentLeadId: lead.id,
      classId: input.classId ?? null,
      enrolledAt: new Date(),
      note: input.note ?? null,
      createdByAccountId: actorAccountId,
    };
    await this.store.saveEnrollment(record);
    return {
      id: record.id,
      appointmentLeadId: record.appointmentLeadId,
      campusId: record.campusId,
      classId: record.classId,
      enrolledAt: record.enrolledAt.toISOString(),
      note: record.note,
      createdByAccountId: record.createdByAccountId,
    };
  }

  private async requireCampusLead(
    campusId: string,
    leadId: string,
  ): Promise<CrmLeadRecord> {
    const lead = await this.store.findById(leadId);
    if (!lead || lead.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '线索不存在');
    }
    return lead;
  }

  private toListItem(lead: CrmLeadRecord): AppointmentLeadListItem {
    return {
      id: lead.id,
      campusId: lead.campusId,
      parentName: lead.parentName,
      phoneMasked: maskPhone(lead.phone),
      childAgeOrGrade: lead.childAgeOrGrade,
      interestedCourse: lead.interestedCourse,
      preferredContactTime: lead.preferredContactTime,
      status: lead.status,
      assigneeAccountId: lead.assigneeAccountId,
      note: lead.note,
      source: lead.source as AppointmentLeadListItem['source'],
      nextContactAt: lead.nextContactAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }
}
