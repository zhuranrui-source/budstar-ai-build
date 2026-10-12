import { randomUUID } from 'node:crypto';
import { CrmLeadsService, InMemoryCrmLeadStore } from './crm-leads.service';

describe('CrmLeadsService', () => {
  it('masks phones, rejects illegal jumps, and requires reopen reasons', async () => {
    const store = new InMemoryCrmLeadStore();
    const leadId = randomUUID();
    const actorId = randomUUID();
    store.seed({
      id: leadId,
      campusId: 'shenzhen-nanshan',
      parentName: '陈女士',
      phone: '13800138000',
      childAgeOrGrade: '小学四年级',
      interestedCourse: 'Vibe Coding',
      preferredContactTime: '周末下午',
      status: 'PENDING_CONTACT',
      assigneeAccountId: null,
      note: null,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const service = new CrmLeadsService(store);

    const listed = await service.list('shenzhen-nanshan', {});
    expect(listed[0]?.phoneMasked).toBe('138****8000');
    expect(JSON.stringify(listed)).not.toContain('13800138000');

    await expect(
      service.transition('shenzhen-nanshan', leadId, actorId, {
        toStatus: 'ENROLLED',
      }),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });

    await service.transition('shenzhen-nanshan', leadId, actorId, {
      toStatus: 'CONTACTED',
      note: '已接通',
    });
    await service.transition('shenzhen-nanshan', leadId, actorId, {
      toStatus: 'CLOSED',
      note: '暂无意向',
    });

    await expect(
      service.transition('shenzhen-nanshan', leadId, actorId, {
        toStatus: 'CONTACTED',
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });

    const reopened = await service.transition(
      'shenzhen-nanshan',
      leadId,
      actorId,
      {
        toStatus: 'CONTACTED',
        reopenReason: '家长再次咨询',
      },
    );
    expect(reopened.status).toBe('CONTACTED');

    const history = await service.getHistory('shenzhen-nanshan', leadId);
    expect(history.at(-1)?.note).toBe('家长再次咨询');
  });
});
