import {
  createSubjectCourseSchema,
  subjectChapterDraftSchema,
} from '@budstar/contracts';
import {
  InMemorySubjectCourseStore,
  SubjectCoursesService,
} from './subject-courses.service';

function draftInput(overrides?: {
  subject?: 'MATH' | 'CHINESE';
  gradeLevel?: number;
}) {
  return createSubjectCourseSchema.parse({
    subject: overrides?.subject ?? 'MATH',
    gradeBand: 'PRIMARY',
    gradeLevel: overrides?.gradeLevel ?? 3,
    title: '三年级数学上册 AI 理解课',
    chapters: [
      subjectChapterDraftSchema.parse({
        sequence: 1,
        title: '时分秒',
        contentHtml: '<p>认识时钟……</p>',
        aiGuidePrompt: '用生活例子引导学生理解时间单位',
      }),
      subjectChapterDraftSchema.parse({
        sequence: 2,
        title: '万以内的加减法',
        contentHtml: '<p>列竖式……</p>',
      }),
    ],
  });
}

describe('SubjectCoursesService (学科内容库)', () => {
  it('creates a draft and keeps chapters ordered', async () => {
    const service = new SubjectCoursesService(new InMemorySubjectCourseStore());
    const created = await service.createDraft(draftInput());
    expect(created.status).toBe('DRAFT');
    expect(created.chapterCount).toBe(2);

    const detail = await service.get(created.id);
    expect(detail.chapters[0].title).toBe('时分秒');
    expect(detail.chapters[0].aiGuidePrompt).toContain('生活例子');
  });

  it('publishes one-way and blocks edits after publish', async () => {
    const store = new InMemorySubjectCourseStore();
    const service = new SubjectCoursesService(store);
    const created = await service.createDraft(draftInput());

    await service.publish(created.id);
    const published = await service.get(created.id);
    expect(published.status).toBe('PUBLISHED');

    await expect(service.replaceChapters(created.id, [])).rejects.toMatchObject(
      { response: { code: 'CONFLICT' } },
    );
  });

  it('lists published content filtered by subject and grade, hiding drafts', async () => {
    const service = new SubjectCoursesService(new InMemorySubjectCourseStore());
    const math = await service.createDraft(draftInput());
    await service.publish(math.id);
    await service.createDraft(
      draftInput({ subject: 'CHINESE', gradeLevel: 5 }),
    );

    const published = await service.listPublished({
      subject: 'MATH',
      gradeBand: 'PRIMARY',
      gradeLevel: 3,
    });
    expect(published).toHaveLength(1);
    expect(published[0].id).toBe(math.id);

    const chinese = await service.listPublished({ subject: 'CHINESE' });
    expect(chinese).toHaveLength(0);
  });

  it('hides draft detail from the published read path', async () => {
    const service = new SubjectCoursesService(new InMemorySubjectCourseStore());
    const created = await service.createDraft(draftInput());
    await expect(service.getPublished(created.id)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });
});
