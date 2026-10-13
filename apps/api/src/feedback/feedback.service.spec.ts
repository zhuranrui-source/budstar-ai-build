import { randomUUID } from 'node:crypto';
import { FeedbackService, InMemoryFeedbackStore } from './feedback.service';

describe('FeedbackService', () => {
  const campusId = 'shenzhen-nanshan';
  const actorId = randomUUID();
  const submissionId = randomUUID();
  const studentId = randomUUID();
  const classId = randomUUID();

  function setup() {
    const store = new InMemoryFeedbackStore();
    store.seedSubmission({
      id: submissionId,
      campusId,
      classId,
      studentProfileId: studentId,
      studentDisplayName: '小明',
      mainLessonId: randomUUID(),
      lessonSequence: 4,
      lessonTitle: '阶段作品展',
      title: '我的 AI 海报',
      track: 'AIGC',
      status: 'SUBMITTED',
      content: { title: '我的 AI 海报', description: '说明' },
    });
    return new FeedbackService(store);
  }

  it('generates AI draft but never auto-publishes formal feedback', async () => {
    const service = setup();
    const draft = await service.generateAiDraft(campusId, submissionId);
    expect(draft.status).toBe('GENERATED');
    expect(draft.content).toContain('不会自动发布');

    const formal = await service.saveFormalDraft(campusId, actorId, {
      workSubmissionId: submissionId,
      body: '目标清晰，继续迭代。',
      highlights: ['构图'],
      nextSteps: ['补充说明'],
      aiDraftId: draft.id,
    });
    expect(formal.status).toBe('DRAFT');

    await expect(
      service.publishFormal(campusId, formal.id, actorId, {}),
    ).resolves.toMatchObject({ status: 'PUBLISHED' });

    await expect(
      service.publishFormal(campusId, formal.id, actorId, {}),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });
  });

  it('requires human confirm for five-dim and hides numbers from students', async () => {
    const service = setup();
    const evaluation = await service.generateFiveDim(campusId, submissionId);
    expect(evaluation.status).toBe('GENERATED');
    expect(evaluation.scores).toHaveLength(5);

    const confirmed = await service.reviewFiveDim(
      campusId,
      evaluation.id,
      actorId,
      { action: 'confirm' },
    );
    expect(confirmed.status).toBe('CONFIRMED');

    const studentView = await service.getStudentGrowthView(studentId);
    expect(JSON.stringify(studentView)).not.toMatch(/"level"/);
    expect(studentView.badges.length).toBeGreaterThanOrEqual(0);

    const report = await service.generateGrowthReport(campusId, {
      studentProfileId: studentId,
      classId,
      milestone: 4,
    });
    expect(report.status).toBe('PENDING_REVIEW');
    const published = await service.publishGrowthReport(
      campusId,
      report.id,
      actorId,
      { teacherObservation: '本阶段进步明显' },
    );
    expect(published.status).toBe('PUBLISHED');

    const parentView = await service.getParentGrowthView(studentId);
    // ADR-0007：家庭视图不输出数字等级，只有维度与描述性依据
    expect(
      parentView.confirmedEvaluations[0]?.scores[0]?.rationale,
    ).toBeDefined();
    expect(JSON.stringify(parentView).match(/\"level\"/)).toBeNull();
    expect(parentView.publishedReports[0]?.milestone).toBe(4);
  });

  it('builds wechat lesson report only from published formal feedback', async () => {
    const service = setup();
    const formal = await service.saveFormalDraft(campusId, actorId, {
      workSubmissionId: submissionId,
      body: '本节完成度很好。',
      highlights: ['表达清晰'],
      nextSteps: ['继续打磨'],
    });
    await expect(
      service.getLessonReportCopy(campusId, formal.id),
    ).rejects.toMatchObject({ response: { code: 'CONFLICT' } });

    await service.publishFormal(campusId, formal.id, actorId, {});
    const copy = await service.getLessonReportCopy(campusId, formal.id);
    expect(copy.wechatCopy).toContain('【星芽每课一报】');
    expect(copy.wechatCopy).toContain('不自动发送');
    expect(copy.structured.body).toBe('本节完成度很好。');
  });
});
