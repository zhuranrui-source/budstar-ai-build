import {
  createSubjectCourseSchema,
  subjectChapterDraftSchema,
} from '@budstar/contracts';
import { PublicSubjectCoursesController } from './public-subject-courses.controller';
import {
  InMemorySubjectCourseStore,
  SubjectCoursesService,
} from './subject-courses.service';

describe('PublicSubjectCoursesController (未登录浏览)', () => {
  async function setup() {
    const service = new SubjectCoursesService(new InMemorySubjectCourseStore());
    const draft = createSubjectCourseSchema.parse({
      subject: 'MATH',
      gradeBand: 'PRIMARY',
      gradeLevel: 3,
      title: '已发布课程',
      chapters: [
        subjectChapterDraftSchema.parse({
          sequence: 1,
          title: '时分秒',
          contentHtml: '<p>内容</p>',
          aiGuidePrompt: '教师引导语',
        }),
      ],
    });
    const published = await service.createDraft(draft);
    await service.publish(published.id);
    const hidden = await service.createDraft({ ...draft, title: '草稿课程' });
    return {
      controller: new PublicSubjectCoursesController(service),
      published,
      hidden,
    };
  }

  it('lists only published courses', async () => {
    const { controller } = await setup();
    const list = await controller.list();
    expect(list.map((course) => course.title)).toEqual(['已发布课程']);
  });

  it('strips teacher-only AI context from chapter details', async () => {
    const { controller, published } = await setup();
    const detail = await controller.get(published.id);
    expect(detail.chapters[0].title).toBe('时分秒');
    expect(detail.chapters[0].aiGuidePrompt).toBeNull();
    expect(detail.chapters[0].aiContext).toBeNull();
  });

  it('does not expose draft courses', async () => {
    const { controller, hidden } = await setup();
    await expect(controller.get(hidden.id)).rejects.toMatchObject({
      status: 404,
    });
  });
});
