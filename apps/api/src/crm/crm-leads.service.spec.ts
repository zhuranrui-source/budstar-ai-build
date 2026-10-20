import { randomUUID } from 'node:crypto';
import { CrmLeadsService, InMemoryCrmLeadStore } from './crm-leads.service';
import { resetSharedLeadRecords } from '../shared-lead-registry';

beforeEach(() => resetSharedLeadRecords());

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
      source: null,
      nextContactAt: null,
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

describe('CrmLeadsService sales tracking (ISSUE-09)', () => {
  it('sets source and next contact time, and filters overdue leads', async () => {
    const store = new InMemoryCrmLeadStore();
    const leadId = randomUUID();
    store.seed({
      id: leadId,
      campusId: 'shenzhen-nanshan',
      parentName: '王女士',
      phone: '13900139000',
      childAgeOrGrade: '小学三年级',
      interestedCourse: 'AI 星芽种子班',
      preferredContactTime: '工作日晚',
      status: 'CONTACTED',
      assigneeAccountId: null,
      note: null,
      source: null,
      nextContactAt: new Date(Date.now() - 3600_000), // 1h 前 = 逾期
      createdAt: new Date('2026-07-02T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    });
    const service = new CrmLeadsService(store);

    // 来源标记
    const updated = await service.update('shenzhen-nanshan', leadId, {
      source: 'OFFICIAL_SITE',
    });
    expect(updated.source).toBe('OFFICIAL_SITE');

    // 逾期过滤
    const overdue = await service.list('shenzhen-nanshan', {
      overdue: 'true',
    });
    expect(overdue).toHaveLength(1);
    expect(overdue[0]!.id).toBe(leadId);

    // 非逾期 → 空
    const notOverdue = await service.list('shenzhen-nanshan', {
      overdue: 'false',
    });
    expect(notOverdue).toHaveLength(0);

    // 来源筛选
    const bySource = await service.list('shenzhen-nanshan', {
      source: 'OFFICIAL_SITE',
    });
    expect(bySource).toHaveLength(1);
    const byWrongSource = await service.list('shenzhen-nanshan', {
      source: 'REFERRAL',
    });
    expect(byWrongSource).toHaveLength(0);
  });

  it('builds a funnel with counts, overdue, and conversion rates', async () => {
    const store = new InMemoryCrmLeadStore();
    const statuses = [
      'PENDING_CONTACT',
      'PENDING_CONTACT',
      'CONTACTED',
      'VISITED',
      'ENROLLED',
    ] as const;
    statuses.forEach((status, i) => {
      store.seed({
        id: randomUUID(),
        campusId: 'shenzhen-nanshan',
        parentName: `家长${i}`,
        phone: `1380000000${i}`,
        childAgeOrGrade: '小学五年级',
        interestedCourse: 'AIGC',
        preferredContactTime: '周末',
        status,
        assigneeAccountId: null,
        note: null,
        source: null,
        nextContactAt:
          status === 'CONTACTED' ? new Date(Date.now() - 1000) : null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      });
    });
    const service = new CrmLeadsService(store);
    const funnel = await service.funnel('shenzhen-nanshan');

    expect(funnel.stages).toHaveLength(5);
    expect(funnel.stages[0]).toMatchObject({
      status: 'PENDING_CONTACT',
      count: 2,
    });
    expect(funnel.stages[1]).toMatchObject({
      status: 'CONTACTED',
      count: 1,
      overdue: 1,
    });
    expect(funnel.stages[4]).toMatchObject({
      status: 'ENROLLED',
      count: 1,
    });
    // 到达 CONTACTED 及以后 = 3/5 = 60%
    expect(funnel.conversionRates[0]).toEqual({
      from: 'PENDING_CONTACT',
      to: 'CONTACTED',
      rate: 60,
    });
    // 到达 ENROLLED = 1/5 = 20%
    expect(funnel.conversionRates[3]).toEqual({
      from: 'VISITED',
      to: 'ENROLLED',
      rate: 20,
    });
  });
});
