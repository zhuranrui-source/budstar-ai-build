import {
  InMemoryPlatformDataStore,
  PlatformAdminService,
} from './platform-admin.service';

describe('PlatformAdminService', () => {
  it('projects whitelisted fields and masks phones without SQL', async () => {
    const store = new InMemoryPlatformDataStore();
    store.seed('appointment_lead', [
      {
        id: '11111111-1111-1111-1111-111111111111',
        campusId: 'shenzhen-nanshan',
        parentName: '陈女士',
        phone: '13800138000',
        status: 'PENDING_CONTACT',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
    const service = new PlatformAdminService(store);
    const result = await service.browse({
      entity: 'appointment_lead',
      campusId: 'shenzhen-nanshan',
      limit: 20,
    });
    expect(result.fields).toContain('phoneMasked');
    expect(result.rows[0]?.phoneMasked).toBe('138****8000');
    expect(JSON.stringify(result)).not.toContain('13800138000');
    expect(result.rows[0]?.phone).toBeUndefined();
  });

  it('rejects SQL-like browse payloads', async () => {
    const service = new PlatformAdminService(new InMemoryPlatformDataStore());
    await expect(
      service.browse({
        entity: 'campus',
        campusId: 'SELECT * FROM campus',
        limit: 10,
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});
