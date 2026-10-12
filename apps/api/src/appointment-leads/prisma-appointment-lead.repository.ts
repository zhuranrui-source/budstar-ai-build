import { Injectable } from '@nestjs/common';
import type {
  AppointmentLeadRecord,
  AppointmentLeadRepository,
} from './appointment-lead.repository';

type CreateOperation = {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
};

type AppointmentLeadOperation = CreateOperation & {
  findUnique(args: {
    where: { idempotencyKey: string };
  }): Promise<AppointmentLeadRecord | null>;
  findFirst(args: {
    where: {
      inputFingerprint: string;
      createdAt: { gte: Date };
    };
    orderBy: { createdAt: 'desc' };
  }): Promise<AppointmentLeadRecord | null>;
};

export type AppointmentLeadPersistenceClient = {
  appointmentLead: AppointmentLeadOperation;
  appointmentLeadStatusHistory: CreateOperation;
};

export type AppointmentLeadTransactionClient =
  AppointmentLeadPersistenceClient & {
    $transaction<T>(
      operation: (client: AppointmentLeadPersistenceClient) => Promise<T>,
      options?: { isolationLevel: 'Serializable' },
    ): Promise<T>;
  };

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PrismaAppointmentLeadRepository implements AppointmentLeadRepository {
  constructor(private readonly prisma: AppointmentLeadTransactionClient) {}

  findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AppointmentLeadRecord | null> {
    return this.prisma.appointmentLead.findUnique({
      where: { idempotencyKey },
    });
  }

  findRecentDuplicate(
    inputFingerprint: string,
    createdAfter: Date,
  ): Promise<AppointmentLeadRecord | null> {
    return this.prisma.appointmentLead.findFirst({
      where: {
        inputFingerprint,
        createdAt: { gte: createdAfter },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async save(lead: AppointmentLeadRecord): Promise<AppointmentLeadRecord> {
    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            const idempotent = await transaction.appointmentLead.findUnique({
              where: { idempotencyKey: lead.idempotencyKey },
            });
            if (idempotent) {
              return idempotent;
            }

            const duplicate = await transaction.appointmentLead.findFirst({
              where: {
                inputFingerprint: lead.inputFingerprint,
                createdAt: {
                  gte: new Date(lead.createdAt.getTime() - DUPLICATE_WINDOW_MS),
                },
              },
              orderBy: { createdAt: 'desc' },
            });
            if (duplicate) {
              return duplicate;
            }

            await transaction.appointmentLead.create({ data: lead });
            await transaction.appointmentLeadStatusHistory.create({
              data: {
                appointmentLeadId: lead.id,
                campusId: lead.campusId,
                fromStatus: null,
                toStatus: lead.status,
                changedAt: lead.createdAt,
              },
            });
            return lead;
          },
          { isolationLevel: 'Serializable' },
        );
      } catch (error) {
        if (hasPrismaCode(error, 'P2002')) {
          const winner = await this.findByIdempotencyKey(lead.idempotencyKey);
          if (winner) {
            return winner;
          }
        }
        if (
          attempt < MAX_TRANSACTION_ATTEMPTS &&
          (hasPrismaCode(error, 'P2002') || hasPrismaCode(error, 'P2034'))
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Appointment lead transaction retry limit exceeded');
  }
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
