import { request } from './api';
import type { SubmissionStatus } from './submission';

export type StudentSwitcher = {
  students: Array<{
    studentProfileId: string;
    displayName: string;
    campusId?: string;
    bindingId?: string;
  }>;
  selectedStudentProfileId: string | null;
};

export type StudentClass = {
  classId: string;
  className: string;
  classCode?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  coursePackageTitle?: string;
};

export type StudentLesson = {
  mainLessonId: string;
  sequence: number;
  title: string;
  track: 'AIGC' | 'VIBE_CODING';
  theme?: string;
  coreDeliverable?: string;
  learningGoals?: string;
  assignment: {
    id?: string;
    title: string;
    requirements?: string;
    submissionKinds?: string[];
  } | null;
  submission: {
    id: string;
    status: SubmissionStatus;
    updatedAt?: string;
  } | null;
};

export type Curriculum = {
  classId: string;
  className: string;
  coursePackageTitle: string;
  coursePackageVersion: string;
  lessons: StudentLesson[];
};

export type SubjectCourseSummary = {
  id: string;
  subject: string;
  gradeBand: string;
  gradeLevel: number | null;
  title: string;
  status?: 'DRAFT' | 'PUBLISHED';
  publishedAt?: string | null;
  chapterCount: number;
};

export type SubjectChapter = {
  id: string;
  sequence: number;
  title: string;
  contentHtml: string;
  contentUrl: string | null;
  aiGuidePrompt: string | null;
  aiContext: string | null;
};

export type SubjectCourseDetail = SubjectCourseSummary & {
  chapters: SubjectChapter[];
};

export type PlanetPost = {
  id: string;
  title: string;
  body: string;
  visibilityScope: string;
  studentDisplayName: string;
  publishedAt: string | null;
};

export type GrowthReportView = {
  id: string;
  milestone: number;
  summary: string;
  teacherObservation: string | null;
};

export type GrowthViewData = {
  publishedReports: GrowthReportView[];
  confirmedEvaluations: Array<{
    scores: Array<{ dimension: string; rationale: string }>;
  }>;
};

export async function listBoundStudents(
  accessToken: string,
): Promise<StudentSwitcher> {
  return request<StudentSwitcher>('/family/students', accessToken);
}

export async function bindFamilyWithCode(
  accessToken: string,
  familyViewCode: string,
  displaySwitchGranted: boolean,
): Promise<unknown> {
  return request('/family/bindings', accessToken, {
    method: 'POST',
    body: { familyViewCode, displaySwitchGranted },
  });
}

export async function selectActiveStudent(
  accessToken: string,
  studentProfileId: string,
): Promise<StudentSwitcher> {
  return request('/family/active-student', accessToken, {
    method: 'POST',
    body: { studentProfileId },
  });
}

export async function listStudentClasses(
  accessToken: string,
  studentProfileId: string,
): Promise<StudentClass[]> {
  return request(
    `/family/students/${encodeURIComponent(studentProfileId)}/classes`,
    accessToken,
  );
}

export async function getStudentCurriculum(
  accessToken: string,
  studentProfileId: string,
  classId: string,
): Promise<Curriculum> {
  return request(
    `/family/students/${encodeURIComponent(studentProfileId)}/classes/${encodeURIComponent(classId)}/lessons`,
    accessToken,
  );
}

export async function transitionSubmission(
  accessToken: string,
  studentProfileId: string,
  submissionId: string,
  toStatus: 'SUBMITTED' | 'RESUBMITTED',
): Promise<unknown> {
  return request(
    `/family/students/${encodeURIComponent(studentProfileId)}/submissions/${encodeURIComponent(submissionId)}/transitions`,
    accessToken,
    { method: 'POST', body: { toStatus } },
  );
}

/** 学科实验室无需登录即可浏览。 */
export async function listPublishedSubjectCourses(): Promise<
  SubjectCourseSummary[]
> {
  return request<SubjectCourseSummary[]>('/public/subject-courses');
}

export async function getPublishedSubjectCourse(
  courseId: string,
): Promise<SubjectCourseDetail> {
  return request<SubjectCourseDetail>(
    `/public/subject-courses/${encodeURIComponent(courseId)}`,
  );
}

export async function listPlanetFeed(
  accessToken: string,
): Promise<PlanetPost[]> {
  return request<PlanetPost[]>('/family/planet/feed', accessToken);
}

export async function getGrowthView(
  accessToken: string,
  studentProfileId: string,
): Promise<GrowthViewData> {
  return request<GrowthViewData>(
    `/family/growth/${encodeURIComponent(studentProfileId)}`,
    accessToken,
  );
}

export async function saveSubmissionDraft(
  accessToken: string,
  studentProfileId: string,
  input: {
    classId: string;
    mainLessonId: string;
    content: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  return request<{ id: string }>(
    `/family/students/${encodeURIComponent(studentProfileId)}/submissions/draft`,
    accessToken,
    { method: 'PUT', body: input },
  );
}
