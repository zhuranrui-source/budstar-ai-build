import {
  InMemorySubmissionStore,
  SubmissionsService,
} from './submissions.service';

describe('SubmissionsService', () => {
  const studentId = '33333333-3333-4333-8333-333333333333';
  const classId = '44444444-4444-4444-8444-444444444444';
  const lessonId = '55555555-5555-4555-8555-555555555555';
  const assignmentId = '66666666-6666-4666-8666-666666666666';
  const versionId = '77777777-7777-4777-8777-777777777777';

  function createService() {
    const store = new InMemorySubmissionStore();
    store.seedStudent({
      id: studentId,
      campusId: 'campus-a',
      displayName: '小星',
    });
    store.seedClass(
      {
        id: classId,
        campusId: 'campus-a',
        name: '南山一班',
        classCode: 'BSAB12CD',
        status: 'ACTIVE',
        coursePackageVersionId: versionId,
        coursePackageTitle: 'AI 星芽种子实验班',
        coursePackageVersion: '1.0.0',
      },
      [
        {
          id: lessonId,
          sequence: 1,
          track: 'AIGC',
          title: '第 1 课',
          theme: '提示词',
          coreDeliverable: '海报',
          learningGoals: '学会提示词',
          assignment: {
            id: assignmentId,
            title: '提示词作品',
            requirements: '提交标题说明与图片',
            submissionKinds: ['image', 'link'],
          },
        },
        {
          id: '88888888-8888-4888-8888-888888888888',
          sequence: 2,
          track: 'VIBE_CODING',
          title: '第 2 课',
          theme: 'GitHub',
          coreDeliverable: '小项目',
          learningGoals: '学会提交仓库',
          assignment: {
            id: '99999999-9999-4999-8999-999999999999',
            title: '校园助手',
            requirements: 'GitHub + 演示 + 说明',
            submissionKinds: ['github', 'demo'],
          },
        },
      ],
    );
    return { store, service: new SubmissionsService(store) };
  }

  it('joins by class code and returns immutable curriculum', async () => {
    const { service } = createService();
    const membership = await service.joinClass(studentId, {
      classCode: 'BSAB12CD',
    });
    expect(membership.className).toBe('南山一班');

    const curriculum = await service.getCurriculum(studentId, classId);
    expect(curriculum.coursePackageVersion).toBe('1.0.0');
    expect(curriculum.lessons).toHaveLength(2);
    expect(curriculum.lessons[0]?.assignment?.title).toBe('提示词作品');
  });

  it('enforces AIGC/Vibe payload rules and submission status machine', async () => {
    const { service } = createService();
    await service.joinClass(studentId, { classCode: 'BSAB12CD' });

    await expect(
      service.saveDraft(studentId, {
        classId,
        mainLessonId: lessonId,
        content: { title: '', description: '缺标题' },
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });

    const draft = await service.saveDraft(studentId, {
      classId,
      mainLessonId: lessonId,
      content: {
        title: '我的海报',
        description: '校园主题',
        imageUrls: ['https://cdn.example.com/a.png'],
      },
    });
    expect(draft.status).toBe('DRAFT');

    const submitted = await service.transitionOwn(
      studentId,
      draft.id,
      { toStatus: 'SUBMITTED' },
      'account-student',
    );
    expect(submitted.status).toBe('SUBMITTED');

    const needsRevision = await service.transitionCampus(
      'campus-a',
      draft.id,
      { toStatus: 'NEEDS_REVISION', note: '补充说明' },
      'account-teacher',
    );
    expect(needsRevision.status).toBe('NEEDS_REVISION');

    const resubmitted = await service.transitionOwn(
      studentId,
      draft.id,
      { toStatus: 'RESUBMITTED' },
      'account-student',
    );
    expect(resubmitted.status).toBe('RESUBMITTED');

    const completed = await service.transitionCampus(
      'campus-a',
      draft.id,
      { toStatus: 'COMPLETED' },
      'account-teacher',
    );
    expect(completed.status).toBe('COMPLETED');

    await expect(service.listCampusQueue('other-campus', {})).resolves.toEqual(
      [],
    );

    const queue = await service.listCampusQueue('campus-a', {
      status: 'COMPLETED',
    });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.studentDisplayName).toBe('小星');
  });

  it('requires Vibe Coding github and demo urls', async () => {
    const { service } = createService();
    await service.joinClass(studentId, { classCode: 'BSAB12CD' });
    await expect(
      service.saveDraft(studentId, {
        classId,
        mainLessonId: '88888888-8888-4888-8888-888888888888',
        content: {
          title: '校园助手',
          description: '说明',
          githubUrl: 'https://github.com/example/app',
        },
      }),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
});
