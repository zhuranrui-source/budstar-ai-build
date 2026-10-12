import { ClassesService, InMemoryClassStore } from './classes.service';

describe('ClassesService', () => {
  it('binds published course versions and rejects illegal status jumps', async () => {
    const store = new InMemoryClassStore();
    const versionId = '11111111-1111-4111-8111-111111111111';
    store.seedPublishedVersion({
      id: versionId,
      title: 'AI 星芽种子实验班',
      version: '1.0.0',
      status: 'PUBLISHED',
    });
    const service = new ClassesService(store);

    const created = await service.create('shenzhen-nanshan', {
      name: '南山种子一班',
      coursePackageVersionId: versionId,
    });
    expect(created.status).toBe('DRAFT');
    expect(created.classCode).toMatch(/^BS[A-Z0-9]{6}$/);
    expect(created.coursePackageVersion).toBe('1.0.0');

    const activated = await service.update('shenzhen-nanshan', created.id, {
      status: 'ACTIVE',
    });
    expect(activated.status).toBe('ACTIVE');

    await expect(
      service.update('shenzhen-nanshan', created.id, { status: 'DRAFT' }),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });

    await expect(
      service.listStudents('other-campus', created.id),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });
});
