import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type {
  AppointmentLeadCreated,
  CreateAppointmentLeadInput,
} from '@budstar/contracts';
import {
  APPOINTMENT_LEAD_REPOSITORY,
  type AppointmentLeadRepository,
} from './appointment-lead.repository';
import { ApiException } from '../http/api-error';
import { maskPhone } from '../privacy/mask-phone';

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CreateAppointmentLeadResult = {
  lead: AppointmentLeadCreated;
  created: boolean;
};

@Injectable()
export class AppointmentLeadsService {
  private readonly logger = new Logger(AppointmentLeadsService.name);

  constructor(
    @Inject(APPOINTMENT_LEAD_REPOSITORY)
    private readonly repository: AppointmentLeadRepository,
  ) {}

  async create(
    input: CreateAppointmentLeadInput,
    idempotencyKey: string = randomUUID(),
  ): Promise<CreateAppointmentLeadResult> {
    const inputFingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    const idempotentLead =
      await this.repository.findByIdempotencyKey(idempotencyKey);

    if (idempotentLead) {
      if (idempotentLead.inputFingerprint !== inputFingerprint) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'IDEMPOTENCY_CONFLICT',
          '同一幂等键不能用于不同预约内容',
        );
      }
      return { lead: this.toCreated(idempotentLead), created: false };
    }

    const createdAt = new Date();
    const duplicate = await this.repository.findRecentDuplicate(
      inputFingerprint,
      new Date(createdAt.getTime() - DUPLICATE_WINDOW_MS),
    );
    if (duplicate) {
      return { lead: this.toCreated(duplicate), created: false };
    }

    const lead = {
      ...input,
      id: randomUUID(),
      idempotencyKey,
      inputFingerprint,
      status: 'PENDING_CONTACT' as const,
      createdAt,
    };

    const persisted = await this.repository.save(lead);
    if (persisted.inputFingerprint !== inputFingerprint) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'IDEMPOTENCY_CONFLICT',
        '同一幂等键不能用于不同预约内容',
      );
    }

    const created = persisted.id === lead.id;
    if (created) {
      this.logger.log({
        event: 'appointment_lead_created',
        leadId: lead.id,
        campusId: lead.campusId,
        phone: maskPhone(lead.phone),
      });
    }

    return { lead: this.toCreated(persisted), created };
  }

  private toCreated(lead: {
    id: string;
    createdAt: Date;
  }): AppointmentLeadCreated {
    return {
      id: lead.id,
      status: 'PENDING_CONTACT',
      createdAt: lead.createdAt.toISOString(),
    };
  }
}
