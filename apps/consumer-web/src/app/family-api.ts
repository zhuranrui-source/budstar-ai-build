import {
  bindFamilyViewCodeSchema,
  classMembershipSchema,
  saveWorkSubmissionDraftSchema,
  studentClassCurriculumSchema,
  transitionWorkSubmissionSchema,
  workSubmissionDetailSchema,
  familyBindingSummarySchema,
  parentStudentSwitcherSchema,
  recordGuardianConsentSchema,
  selectActiveStudentSchema,
  workDisplayEligibilitySchema,
  type BindFamilyViewCodeInput,
  type FamilyBindingSummary,
  type ParentStudentSwitcher,
  type RecordGuardianConsentInput,
  type SaveWorkSubmissionDraftInput,
  type SelectActiveStudentInput,
  type TransitionWorkSubmissionInput,
  type WorkDisplayEligibility,
  type ClassMembership,
  type StudentClassCurriculum,
  type WorkSubmissionDetail,
} from '@budstar/contracts';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

async function familyRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  fetcher: FetchLike = fetch,
): Promise<T> {
  const response = await fetcher(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`FAMILY_API_${response.status}`);
  }
  return (await response.json()) as T;
}

export async function bindFamilyViewCode(
  accessToken: string,
  input: BindFamilyViewCodeInput,
  fetcher: FetchLike = fetch,
): Promise<FamilyBindingSummary> {
  const body = bindFamilyViewCodeSchema.parse(input);
  const result = await familyRequest<FamilyBindingSummary>(
    '/family/bindings',
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return familyBindingSummarySchema.parse(result);
}

export async function listFamilyBindings(
  accessToken: string,
  fetcher: FetchLike = fetch,
): Promise<FamilyBindingSummary[]> {
  const result = await familyRequest<FamilyBindingSummary[]>(
    '/family/bindings',
    accessToken,
    {},
    fetcher,
  );
  return result.map((item) => familyBindingSummarySchema.parse(item));
}

export async function listBoundStudents(
  accessToken: string,
  fetcher: FetchLike = fetch,
): Promise<ParentStudentSwitcher> {
  const result = await familyRequest<ParentStudentSwitcher>(
    '/family/students',
    accessToken,
    {},
    fetcher,
  );
  return parentStudentSwitcherSchema.parse(result);
}

export async function selectActiveStudent(
  accessToken: string,
  input: SelectActiveStudentInput,
  fetcher: FetchLike = fetch,
): Promise<ParentStudentSwitcher> {
  const body = selectActiveStudentSchema.parse(input);
  const result = await familyRequest<ParentStudentSwitcher>(
    '/family/active-student',
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return parentStudentSwitcherSchema.parse(result);
}

export async function recordGuardianConsent(
  accessToken: string,
  input: RecordGuardianConsentInput,
  fetcher: FetchLike = fetch,
) {
  const body = recordGuardianConsentSchema.parse(input);
  return familyRequest(
    '/family/consents',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    fetcher,
  );
}

export async function getWorkDisplayEligibility(
  accessToken: string,
  studentProfileId: string,
  fetcher: FetchLike = fetch,
): Promise<WorkDisplayEligibility> {
  const result = await familyRequest<WorkDisplayEligibility>(
    `/family/work-display/${studentProfileId}`,
    accessToken,
    {},
    fetcher,
  );
  return workDisplayEligibilitySchema.parse(result);
}

export async function createFamilyPresignedUpload(
  accessToken: string,
  input: {
    fileName: string;
    contentType: string;
    contentLength: number;
    purpose?: 'submission' | 'avatar' | 'report-attachment';
  },
  fetcher: FetchLike = fetch,
) {
  return familyRequest(
    '/family/object-storage/presign',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    fetcher,
  );
}

// ===== 家庭视图学习代理（ADR-0007）：家长以受绑定约束的方式访问学生课节与作品 =====

export async function listStudentClassesForParent(
  accessToken: string,
  studentProfileId: string,
  fetcher: FetchLike = fetch,
): Promise<ClassMembership[]> {
  const result = await familyRequest<ClassMembership[]>(
    `/family/students/${studentProfileId}/classes`,
    accessToken,
    {},
    fetcher,
  );
  return result.map((item) => classMembershipSchema.parse(item));
}

export async function getStudentCurriculumForParent(
  accessToken: string,
  studentProfileId: string,
  classId: string,
  fetcher: FetchLike = fetch,
): Promise<StudentClassCurriculum> {
  const result = await familyRequest<StudentClassCurriculum>(
    `/family/students/${studentProfileId}/classes/${classId}/lessons`,
    accessToken,
    {},
    fetcher,
  );
  return studentClassCurriculumSchema.parse(result);
}

export async function saveStudentSubmissionDraftForParent(
  accessToken: string,
  studentProfileId: string,
  input: SaveWorkSubmissionDraftInput,
  fetcher: FetchLike = fetch,
): Promise<WorkSubmissionDetail> {
  const body = saveWorkSubmissionDraftSchema.parse(input);
  const result = await familyRequest<WorkSubmissionDetail>(
    `/family/students/${studentProfileId}/submissions/draft`,
    accessToken,
    { method: 'PUT', body: JSON.stringify(body) },
    fetcher,
  );
  return workSubmissionDetailSchema.parse(result);
}

export async function transitionStudentSubmissionForParent(
  accessToken: string,
  studentProfileId: string,
  submissionId: string,
  input: TransitionWorkSubmissionInput,
  fetcher: FetchLike = fetch,
): Promise<WorkSubmissionDetail> {
  const body = transitionWorkSubmissionSchema.parse(input);
  const result = await familyRequest<WorkSubmissionDetail>(
    `/family/students/${studentProfileId}/submissions/${submissionId}/transitions`,
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return workSubmissionDetailSchema.parse(result);
}

// ===== 学科互动实验室（家庭视图只读已发布目录 + AI 个性化讲解） =====

export type SubjectCourseSummaryView = {
  id: string;
  subject: string;
  gradeBand: string;
  gradeLevel: number | null;
  title: string;
  chapterCount: number;
};

export type SubjectChapterView = {
  id: string;
  sequence: number;
  title: string;
  contentUrl: string | null;
  aiContext: string | null;
};

export type SubjectCourseDetailView = SubjectCourseSummaryView & {
  chapters: SubjectChapterView[];
};

export async function listSubjectCoursesForFamily(
  accessToken: string,
  fetcher: FetchLike = fetch,
): Promise<SubjectCourseSummaryView[]> {
  return familyRequest<SubjectCourseSummaryView[]>(
    '/family/subject-courses',
    accessToken,
    {},
    fetcher,
  );
}

export async function getSubjectCourseForFamily(
  accessToken: string,
  courseId: string,
  fetcher: FetchLike = fetch,
): Promise<SubjectCourseDetailView> {
  return familyRequest<SubjectCourseDetailView>(
    `/family/subject-courses/${courseId}`,
    accessToken,
    {},
    fetcher,
  );
}

export async function explainSubjectChapter(
  accessToken: string,
  courseId: string,
  chapterId: string,
  question: string,
  fetcher: FetchLike = fetch,
): Promise<{ answer: string }> {
  return familyRequest<{ answer: string }>(
    `/family/subject-courses/${courseId}/chapters/${chapterId}/explain`,
    accessToken,
    { method: 'POST', body: JSON.stringify({ question }) },
    fetcher,
  );
}
