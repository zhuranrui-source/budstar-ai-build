import { FamilyService, InMemoryFamilyStore } from './family.service';

describe('FamilyService', () => {
  const campusId = 'shenzhen-nanshan';

  function createService() {
    const store = new InMemoryFamilyStore();
    const synced = new Map<string, string[]>();
    const service = new FamilyService(store, {
      syncActiveStudentBindings(userAccountId, studentProfileIds) {
        synced.set(userAccountId, studentProfileIds);
      },
    });
    return { service, store, synced };
  }

  it('issues view codes, binds parents, and revokes access immediately', async () => {
    const { service, synced } = createService();
    const created = await service.createStudent(campusId, {
      displayName: '小星',
    });
    expect(created.familyViewCode).toMatch(/^[A-F0-9]{8}$/);

    const bound = await service.bindWithViewCode(
      {
        userAccountId: 'parent-account',
        parentProfileId: '11111111-1111-4111-8111-111111111111',
        displayName: '家长',
      },
      { familyViewCode: created.familyViewCode },
    );
    expect(bound.status).toBe('ACTIVE');
    expect(synced.get('parent-account')).toEqual([created.studentProfileId]);

    const switcher = await service.getStudentSwitcher(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(switcher.students).toHaveLength(1);
    expect(switcher.selectedStudentProfileId).toBe(created.studentProfileId);

    await service.revokeOwnBinding(
      '11111111-1111-4111-8111-111111111111',
      bound.id,
    );
    expect(synced.get('parent-account')).toEqual([]);

    await expect(
      service.listConsents(
        '11111111-1111-4111-8111-111111111111',
        created.studentProfileId,
      ),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('blocks public work display without WORK_DISPLAY consent', async () => {
    const { service } = createService();
    const created = await service.createStudent(campusId, {
      displayName: '小芽',
    });
    const parent = {
      userAccountId: 'parent-2',
      parentProfileId: '22222222-2222-4222-8222-222222222222',
      displayName: '家长二',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
    });

    const missing = await service.getWorkDisplayEligibility(
      created.studentProfileId,
      { parentProfileId: parent.parentProfileId },
    );
    expect(missing.canDisplayPublicly).toBe(false);
    expect(missing.reason).toBe('WORK_DISPLAY_MISSING');

    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'WORK_DISPLAY',
      granted: true,
      policyVersion: '2026-07-01',
    });
    const granted = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(granted.canDisplayPublicly).toBe(true);

    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'WORK_DISPLAY',
      granted: false,
      policyVersion: '2026-07-01',
    });
    await expect(
      service.assertWorkDisplayAllowed(created.studentProfileId),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('rejects illegal binding status jumps when revoking twice', async () => {
    const { service } = createService();
    const created = await service.createStudent(campusId, {
      displayName: '小果',
    });
    const parent = {
      userAccountId: 'parent-3',
      parentProfileId: '33333333-3333-4333-8333-333333333333',
      displayName: '家长三',
    };
    const bound = await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
    });
    await service.revokeBindingAsStaff(campusId, bound.id);
    await expect(
      service.revokeBindingAsStaff(campusId, bound.id),
    ).resolves.toMatchObject({ status: 'REVOKED' });
  });

  it('only allows switching among actively bound students', async () => {
    const { service } = createService();
    const first = await service.createStudent(campusId, {
      displayName: '一号',
    });
    const second = await service.createStudent(campusId, {
      displayName: '二号',
    });
    const parent = {
      userAccountId: 'parent-4',
      parentProfileId: '44444444-4444-4444-8444-444444444444',
      displayName: '家长四',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: first.familyViewCode,
    });
    await service.bindWithViewCode(parent, {
      familyViewCode: second.familyViewCode,
    });
    const switched = await service.selectActiveStudent(parent.parentProfileId, {
      studentProfileId: second.studentProfileId,
    });
    expect(switched.selectedStudentProfileId).toBe(second.studentProfileId);
    await expect(
      service.selectActiveStudent(parent.parentProfileId, {
        studentProfileId: '55555555-5555-4555-8555-555555555555',
      }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });
});

describe('FamilyService display switch (ADR-0008)', () => {
  const campusId = 'shenzhen-nanshan';

  function createService() {
    const store = new InMemoryFamilyStore();
    const service = new FamilyService(store, {
      syncActiveStudentBindings() {},
    });
    return { service, store };
  }

  async function bindParent(
    service: ReturnType<typeof createService>['service'],
  ) {
    const created = await service.createStudent(campusId, {
      displayName: '小星芽',
    });
    const parent = {
      userAccountId: `parent-${created.studentProfileId.slice(0, 8)}`,
      parentProfileId: '44444444-4444-4444-8444-444444444444',
      displayName: '家长四',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
    });
    return { created, parent };
  }

  it('grants public display via one-time DISPLAY_SWITCH without per-work consent', async () => {
    const { service } = createService();
    const { created, parent } = await bindParent(service);

    const missing = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(missing.canDisplayPublicly).toBe(false);

    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'DISPLAY_SWITCH',
      granted: true,
      policyVersion: '2026-08-01',
    });

    const granted = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(granted.canDisplayPublicly).toBe(true);
    expect(granted.reason).toBe('DISPLAY_SWITCH_GRANTED');
    await expect(
      service.assertWorkDisplayAllowed(created.studentProfileId),
    ).resolves.toBeUndefined();
  });

  it('revokes future public display immediately when switch is turned off', async () => {
    const { service } = createService();
    const { created, parent } = await bindParent(service);
    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'DISPLAY_SWITCH',
      granted: true,
      policyVersion: '2026-08-01',
    });

    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'DISPLAY_SWITCH',
      granted: false,
      policyVersion: '2026-08-01',
    });

    const revoked = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(revoked.canDisplayPublicly).toBe(false);
    expect(revoked.reason).toBe('DISPLAY_SWITCH_REVOKED');
    await expect(
      service.assertWorkDisplayAllowed(created.studentProfileId),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('falls back to legacy WORK_DISPLAY consent when no switch exists', async () => {
    const { service } = createService();
    const { created, parent } = await bindParent(service);
    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'WORK_DISPLAY',
      granted: true,
      policyVersion: '2026-07-01',
    });

    const legacy = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(legacy.canDisplayPublicly).toBe(true);
    expect(legacy.reason).toBe('WORK_DISPLAY_GRANTED');

    await service.recordConsent(parent, {
      studentProfileId: created.studentProfileId,
      type: 'DISPLAY_SWITCH',
      granted: false,
      policyVersion: '2026-08-01',
    });
    const overridden = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(overridden.canDisplayPublicly).toBe(false);
    expect(overridden.reason).toBe('DISPLAY_SWITCH_REVOKED');
  });
});

describe('FamilyService binding-time display switch (ADR-0008)', () => {
  const campusId = 'shenzhen-nanshan';

  function createService() {
    const store = new InMemoryFamilyStore();
    const service = new FamilyService(store, {
      syncActiveStudentBindings() {},
    });
    return { service, store };
  }

  it('records DISPLAY_SWITCH consent during binding when granted flag is set', async () => {
    const { service } = createService();
    const created = await service.createStudent(campusId, {
      displayName: '小苗',
    });
    const parent = {
      userAccountId: 'parent-bind-switch',
      parentProfileId: '55555555-5555-4555-8555-555555555555',
      displayName: '家长五',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
      displaySwitchGranted: true,
    });

    const eligibility = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(eligibility.canDisplayPublicly).toBe(true);
    expect(eligibility.reason).toBe('DISPLAY_SWITCH_GRANTED');
  });

  it('does not record a switch when the flag is omitted', async () => {
    const { service } = createService();
    const created = await service.createStudent(campusId, {
      displayName: '小叶',
    });
    const parent = {
      userAccountId: 'parent-bind-no-switch',
      parentProfileId: '66666666-6666-4666-8666-666666666666',
      displayName: '家长六',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
    });

    const eligibility = await service.getWorkDisplayEligibility(
      created.studentProfileId,
    );
    expect(eligibility.canDisplayPublicly).toBe(false);
    expect(eligibility.reason).toBe('WORK_DISPLAY_MISSING');
  });
});

describe('FamilyService parent-student access (ADR-0007)', () => {
  it('allows bound parents and rejects unbound ones', async () => {
    const store = new InMemoryFamilyStore();
    const service = new FamilyService(store, {
      syncActiveStudentBindings() {},
    });
    const created = await service.createStudent('shenzhen-nanshan', {
      displayName: '小荷',
    });
    const parent = {
      userAccountId: 'parent-access',
      parentProfileId: '77777777-7777-4777-8777-777777777777',
      displayName: '家长七',
    };
    await service.bindWithViewCode(parent, {
      familyViewCode: created.familyViewCode,
    });

    await expect(
      service.assertParentStudentAccess(
        parent.parentProfileId,
        created.studentProfileId,
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertParentStudentAccess(
        '88888888-8888-4888-8888-888888888888',
        created.studentProfileId,
      ),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });
});
