import type {
  AppointmentLeadStatus,
  CreateAppointmentLeadInput,
} from '@budstar/contracts';

export const APPOINTMENT_LEAD_REPOSITORY = Symbol(
  'APPOINTMENT_LEAD_REPOSITORY',
);

export type AppointmentLeadRecord = CreateAppointmentLeadInput & {
  id: string;
  idempotencyKey: string;
  inputFingerprint: string;
  status: AppointmentLeadStatus;
  createdAt: Date;
};

export interface AppointmentLeadRepository {
  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AppointmentLeadRecord | null>;
  findRecentDuplicate(
    inputFingerprint: string,
    createdAfter: Date,
  ): Promise<AppointmentLeadRecord | null>;
  save(lead: AppointmentLeadRecord): Promise<AppointmentLeadRecord>;
}

import { sharedLeadRecords } from '../shared-lead-registry';

export class InMemoryAppointmentLeadRepository implements AppointmentLeadRepository {
  private readonly leads = sharedLeadRecords as Map<
    string,
    AppointmentLeadRecord
  >;

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AppointmentLeadRecord | null> {
    return Promise.resolve(
      [...this.leads.values()].find(
        (lead) => lead.idempotencyKey === idempotencyKey,
      ) ?? null,
    );
  }

  findRecentDuplicate(
    inputFingerprint: string,
    createdAfter: Date,
  ): Promise<AppointmentLeadRecord | null> {
    return Promise.resolve(
      [...this.leads.values()].find(
        (lead) =>
          lead.inputFingerprint === inputFingerprint &&
          lead.createdAt >= createdAfter,
      ) ?? null,
    );
  }

  save(lead: AppointmentLeadRecord): Promise<AppointmentLeadRecord> {
    const idempotent = [...this.leads.values()].find(
      (existing) => existing.idempotencyKey === lead.idempotencyKey,
    );
    if (idempotent) {
      return Promise.resolve(idempotent);
    }
    const duplicate = [...this.leads.values()].find(
      (existing) =>
        existing.inputFingerprint === lead.inputFingerprint &&
        existing.createdAt >=
          new Date(lead.createdAt.getTime() - 24 * 60 * 60 * 1000),
    );
    if (duplicate) {
      return Promise.resolve(duplicate);
    }
    this.leads.set(lead.id, lead);
    return Promise.resolve(lead);
  }
}
