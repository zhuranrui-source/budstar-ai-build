import { describe, expect, it } from 'vitest';
import { previewRequest } from './preview';

describe('acceptance preview data', () => {
  it('provides every tab with representative data', async () => {
    const students = await previewRequest<{
      students: unknown[];
      selectedStudentProfileId: string;
    }>('/family/students');
    const courses = await previewRequest<Array<{ id: string }>>(
      '/family/subject-courses',
    );
    const detail = await previewRequest<{ chapters: unknown[] }>(
      `/family/subject-courses/${courses[0].id}`,
    );
    const posts = await previewRequest<unknown[]>('/family/planet/feed');
    const growth = await previewRequest<{ publishedReports: unknown[] }>(
      '/family/growth/preview-student-1',
    );

    expect(students.students.length).toBeGreaterThan(1);
    expect(students.selectedStudentProfileId).toBeTruthy();
    expect(courses.length).toBeGreaterThan(0);
    expect(detail.chapters.length).toBeGreaterThan(0);
    expect(posts.length).toBeGreaterThan(0);
    expect(growth.publishedReports.length).toBeGreaterThan(0);
  });

  it('supports student switching and submission transitions', async () => {
    const switched = await previewRequest<{ selectedStudentProfileId: string }>(
      '/family/active-student',
      {
        method: 'POST',
        body: { studentProfileId: 'preview-student-2' },
      },
    );
    expect(switched.selectedStudentProfileId).toBe('preview-student-2');

    await previewRequest(
      '/family/students/preview-student-2/submissions/preview-submission-2/transitions',
      {
        method: 'POST',
        body: { toStatus: 'SUBMITTED' },
      },
    );
    const curriculum = await previewRequest<{
      lessons: Array<{
        mainLessonId: string;
        submission: { status: string } | null;
      }>;
    }>('/family/students/preview-student-2/classes/preview-class-1/lessons');
    expect(
      curriculum.lessons.find(
        (lesson) => lesson.mainLessonId === 'preview-lesson-2',
      )?.submission?.status,
    ).toBe('SUBMITTED');
  });
});
