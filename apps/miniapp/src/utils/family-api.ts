/**
 * 家庭视图 API（ADR-0007）：家长 token 经家庭代理访问学生课节与作品；
 * 学科内容（K12 互动实验室）按学段/学科只读已发布目录。
 */
import { request, type WechatSession } from './api';

export type StudentSwitcher = {
  students: Array<{ studentProfileId: string; displayName: string }>;
  selectedStudentProfileId: string | null;
};

export type StudentLesson = {
  mainLessonId: string;
  sequence: number;
  title: string;
  track: string;
  assignment: { title: string } | null;
  submission: { id: string; status: string } | null;
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
  chapterCount: number;
};

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function listBoundStudents(
  accessToken: string,
): Promise<StudentSwitcher> {
  return request<StudentSwitcher>('/family/students', accessToken);
}

export async function selectActiveStudent(
  accessToken: string,
  studentProfileId: string,
): Promise<unknown> {
  return request('/family/active-student', accessToken, {
    method: 'POST',
    body: JSON.stringify({ studentProfileId }),
  });
}

export async function listStudentClasses(
  accessToken: string,
  studentProfileId: string,
): Promise<Array<{ classId: string; className: string }>> {
  return request(`/family/students/${studentProfileId}/classes`, accessToken);
}

export async function getStudentCurriculum(
  accessToken: string,
  studentProfileId: string,
  classId: string,
): Promise<Curriculum> {
  return request<Curriculum>(
    `/family/students/${studentProfileId}/classes/${classId}/lessons`,
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
    `/family/students/${studentProfileId}/submissions/${submissionId}/transitions`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ toStatus }) },
  );
}

export async function listPublishedSubjectCourses(
  accessToken: string,
): Promise<SubjectCourseSummary[]> {
  // 家庭视图读取面（ADR-0007）；partner 端点是合作方专属，家长 token 会被 403
  return request<SubjectCourseSummary[]>(
    '/family/subject-courses',
    accessToken,
  );
}

export type { WechatSession };

// ===== 星芽星球与成长报告（家庭视图读取面） =====

export type PlanetPost = {
  id: string;
  title: string;
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
    `/family/growth/${studentProfileId}`,
    accessToken,
  );
}

export async function saveSubmissionDraft(
  accessToken: string,
  studentProfileId: string,
  input: {
    classId: string;
    mainLessonId: string;
    content: {
      title: string;
      description: string;
      imageUrls?: string[];
      workUrl?: string;
    };
  },
): Promise<{ id: string }> {
  return request<{ id: string }>(
    `/family/students/${studentProfileId}/submissions/draft`,
    accessToken,
    { method: 'PUT', body: JSON.stringify(input) },
  );
}
