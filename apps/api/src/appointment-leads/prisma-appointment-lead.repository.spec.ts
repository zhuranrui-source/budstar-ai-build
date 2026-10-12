import type { AppointmentLeadRecord } from './appointment-lead.repository';
import {
  PrismaAppointmentLeadRepository,
  type AppointmentLeadPersistenceClient,
} from './prisma-appointment-lead.repository';

describe('PrismaAppointmentLeadRepository', () => {
  it('writes the lead and its initial status history in one transaction', async () => {
    const leadCreate = jest.fn().mockResolvedValue(undefined);
    const historyCreate = jest.fn().mockResolvedValue(undefined);
    const persistenceClient: AppointmentLeadPersistenceClient = {
      appointmentLead: {
        create: leadCreate,
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      appointmentLeadStatusHistory: { create: historyCreate },
    };
    const transaction = async <T>(
      operation: (client: AppointmentLeadPersistenceClient) => Promise<T>,
    ) => operation(persistenceClient);
    const repository = new PrismaAppointmentLeadRepository({
      ...persistenceClient,
      $transaction: transaction,
    });
    const lead: AppointmentLeadRecord = {
      id: 'lead-1',
      campusId: 'campus-a',
      parentName: '陈女士',
      phone: '13800138000',
      childAgeOrGrade: '小学四年级',
      interestedCourse: 'Vibe Coding',
      preferredContactTime: '工作日晚间',
      idempotencyKey: 'appointment-1',
      inputFingerprint: 'a'.repeat(64),
      status: 'PENDING_CONTACT',
      createdAt: new Date('2026-07-14T06:00:00.000Z'),
    };

    await repository.save(lead);

    expect(leadCreate).toHaveBeenCalledWith({ data: lead });
    expect(historyCreate).toHaveBeenCalledWith({
      data: {
        appointmentLeadId: 'lead-1',
        campusId: 'campus-a',
        fromStatus: null,
        toStatus: 'PENDING_CONTACT',
        changedAt: lead.createdAt,
      },
    });
  });

  it('reads back the winning row after an idempotency unique conflict', async () => {
    const lead = {
      id: 'lead-loser',
      campusId: 'campus-a',
      parentName: '陈女士',
      phone: '13800138000',
      childAgeOrGrade: '小学四年级',
      interestedCourse: 'Vibe Coding',
      preferredContactTime: '工作日晚间',
      idempotencyKey: 'appointment-race',
      inputFingerprint: 'a'.repeat(64),
      status: 'PENDING_CONTACT' as const,
      createdAt: new Date('2026-07-14T06:00:00.000Z'),
    };
    const winner = { ...lead, id: 'lead-winner' };
    const persistenceClient: AppointmentLeadPersistenceClient = {
      appointmentLead: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      appointmentLeadStatusHistory: { create: jest.fn() },
    };
    const repository = new PrismaAppointmentLeadRepository({
      appointmentLead: {
        ...persistenceClient.appointmentLead,
        findUnique: jest.fn().mockResolvedValue(winner),
      },
      appointmentLeadStatusHistory:
        persistenceClient.appointmentLeadStatusHistory,
      $transaction: jest.fn(async (operation) => operation(persistenceClient)),
    });

    await expect(repository.save(lead)).resolves.toEqual(winner);
  });
});
