import {
  aiTeacherChatRequestSchema,
  aiTeacherChatResponseSchema,
  classMembershipSchema,
  joinClassByCodeSchema,
  saveWorkSubmissionDraftSchema,
  studentClassCurriculumSchema,
  transitionWorkSubmissionSchema,
  workSubmissionDetailSchema,
  type AiTeacherChatRequest,
  type AiTeacherChatResponse,
  type ClassMembership,
  type JoinClassByCodeInput,
  type SaveWorkSubmissionDraftInput,
  type StudentClassCurriculum,
  type TransitionWorkSubmissionInput,
  type WorkSubmissionDetail,
} from '@budstar/contracts';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

async function studentRequest<T>(
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
    throw new Error(`STUDENT_API_${response.status}`);
  }
  return (await response.json()) as T;
}

export async function joinClassByCode(
  accessToken: string,
  input: JoinClassByCodeInput,
  fetcher: FetchLike = fetch,
): Promise<ClassMembership> {
  const body = joinClassByCodeSchema.parse(input);
  const result = await studentRequest<ClassMembership>(
    '/student/classes/join',
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return classMembershipSchema.parse(result);
}

export async function listStudentClasses(
  accessToken: string,
  fetcher: FetchLike = fetch,
): Promise<ClassMembership[]> {
  const result = await studentRequest<ClassMembership[]>(
    '/student/classes',
    accessToken,
    {},
    fetcher,
  );
  return result.map((item) => classMembershipSchema.parse(item));
}

export async function getStudentCurriculum(
  accessToken: string,
  classId: string,
  fetcher: FetchLike = fetch,
): Promise<StudentClassCurriculum> {
  const result = await studentRequest<StudentClassCurriculum>(
    `/student/classes/${classId}/lessons`,
    accessToken,
    {},
    fetcher,
  );
  return studentClassCurriculumSchema.parse(result);
}

export async function saveSubmissionDraft(
  accessToken: string,
  input: SaveWorkSubmissionDraftInput,
  fetcher: FetchLike = fetch,
): Promise<WorkSubmissionDetail> {
  const body = saveWorkSubmissionDraftSchema.parse(input);
  const result = await studentRequest<WorkSubmissionDetail>(
    '/student/submissions/draft',
    accessToken,
    { method: 'PUT', body: JSON.stringify(body) },
    fetcher,
  );
  return workSubmissionDetailSchema.parse(result);
}

export async function transitionOwnSubmission(
  accessToken: string,
  submissionId: string,
  input: TransitionWorkSubmissionInput,
  fetcher: FetchLike = fetch,
): Promise<WorkSubmissionDetail> {
  const body = transitionWorkSubmissionSchema.parse(input);
  const result = await studentRequest<WorkSubmissionDetail>(
    `/student/submissions/${submissionId}/transitions`,
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return workSubmissionDetailSchema.parse(result);
}

export async function chatWithAiTeacher(
  accessToken: string,
  input: AiTeacherChatRequest,
  fetcher: FetchLike = fetch,
): Promise<AiTeacherChatResponse> {
  const body = aiTeacherChatRequestSchema.parse(input);
  const result = await studentRequest<AiTeacherChatResponse>(
    '/ai-teacher/chat',
    accessToken,
    { method: 'POST', body: JSON.stringify(body) },
    fetcher,
  );
  return aiTeacherChatResponseSchema.parse(result);
}
