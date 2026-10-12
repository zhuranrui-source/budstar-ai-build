import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canTransitionWorkSubmissionStatus,
  isStudentInitiatedSubmissionTransition,
  isTeacherInitiatedSubmissionTransition,
  type ClassMembership,
  type JoinClassByCodeInput,
  type ListWorkSubmissionsQuery,
  type MainLessonTrack,
  type SaveWorkSubmissionDraftInput,
  type StudentClassCurriculum,
  type StudentLesson,
  type TransitionWorkSubmissionInput,
  type WorkSubmissionDetail,
  type WorkSubmissionStatus,
  type WorkSubmissionSummary,
  validateSubmissionPayloadForTrack,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type SubmissionLessonRef = {
  id: string;
  sequence: number;
  track: MainLessonTrack;
  title: string;
  theme: string;
  coreDeliverable: string;
  learningGoals: string;
  assignment: {
    id: string;
    title: string;
    requirements: string;
    submissionKinds: string[];
  } | null;
};

export type SubmissionClassRef = {
  id: string;
  campusId: string;
  name: string;
  classCode: string;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  coursePackageVersionId: string;
  coursePackageTitle: string;
  coursePackageVersion: string;
};

export type SubmissionStudentRef = {
  id: string;
  campusId: string;
  displayName: string;
};

export type WorkSubmissionRecord = {
  id: string;
  campusId: string;
  classId: string;
  studentProfileId: string;
  mainLessonId: string;
  assignmentTemplateId: string;
  track: MainLessonTrack;
  status: WorkSubmissionStatus;
  title: string;
  content: Record<string, unknown>;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkSubmissionHistoryRecord = {
  id: string;
  campusId: string;
  workSubmissionId: string;
  fromStatus: WorkSubmissionStatus | null;
  toStatus: WorkSubmissionStatus;
  changedByAccountId: string | null;
  changedAt: Date;
  note: string | null;
};

export type ClassMembershipRecord = {
  classId: string;
  campusId: string;
  studentProfileId: string;
  joinedAt: Date;
};

export interface SubmissionStore {
  findStudent(studentProfileId: string): Promise<SubmissionStudentRef | null>;
  findClass(classId: string): Promise<SubmissionClassRef | null>;
  findClassByCode(classCode: string): Promise<SubmissionClassRef | null>;
  listLessonsForVersion(
    coursePackageVersionId: string,
  ): Promise<SubmissionLessonRef[]>;
  findLesson(mainLessonId: string): Promise<SubmissionLessonRef | null>;
  listMemberships(studentProfileId: string): Promise<ClassMembershipRecord[]>;
  findMembership(
    classId: string,
    studentProfileId: string,
  ): Promise<ClassMembershipRecord | null>;
  saveMembership(record: ClassMembershipRecord): Promise<ClassMembershipRecord>;
  findSubmission(
    classId: string,
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<WorkSubmissionRecord | null>;
  findSubmissionById(id: string): Promise<WorkSubmissionRecord | null>;
  listSubmissions(
    campusId: string,
    query: ListWorkSubmissionsQuery,
  ): Promise<WorkSubmissionRecord[]>;
  listSubmissionsForStudent(
    studentProfileId: string,
  ): Promise<WorkSubmissionRecord[]>;
  saveSubmission(record: WorkSubmissionRecord): Promise<WorkSubmissionRecord>;
  appendHistory(
    history: WorkSubmissionHistoryRecord,
  ): Promise<WorkSubmissionHistoryRecord>;
}

export class InMemorySubmissionStore implements SubmissionStore {
  private readonly students = new Map<string, SubmissionStudentRef>();
  private readonly classes = new Map<string, SubmissionClassRef>();
  private readonly lessonsByVersion = new Map<string, SubmissionLessonRef[]>();
  private readonly lessons = new Map<string, SubmissionLessonRef>();
  private readonly memberships = new Map<string, ClassMembershipRecord>();
  private readonly submissions = new Map<string, WorkSubmissionRecord>();
  private readonly history = new Map<string, WorkSubmissionHistoryRecord[]>();

  seedStudent(student: SubmissionStudentRef): void {
    this.students.set(student.id, student);
  }

  seedClass(
    classRef: SubmissionClassRef,
    lessons: SubmissionLessonRef[],
  ): void {
    this.classes.set(classRef.id, classRef);
    this.lessonsByVersion.set(classRef.coursePackageVersionId, lessons);
    for (const lesson of lessons) {
      this.lessons.set(lesson.id, lesson);
    }
  }

  findStudent(studentProfileId: string): Promise<SubmissionStudentRef | null> {
    return Promise.resolve(this.students.get(studentProfileId) ?? null);
  }

  findClass(classId: string): Promise<SubmissionClassRef | null> {
    return Promise.resolve(this.classes.get(classId) ?? null);
  }

  findClassByCode(classCode: string): Promise<SubmissionClassRef | null> {
    return Promise.resolve(
      [...this.classes.values()].find((item) => item.classCode === classCode) ??
        null,
    );
  }

  listLessonsForVersion(
    coursePackageVersionId: string,
  ): Promise<SubmissionLessonRef[]> {
    return Promise.resolve(
      this.lessonsByVersion.get(coursePackageVersionId) ?? [],
    );
  }

  findLesson(mainLessonId: string): Promise<SubmissionLessonRef | null> {
    return Promise.resolve(this.lessons.get(mainLessonId) ?? null);
  }

  listMemberships(studentProfileId: string): Promise<ClassMembershipRecord[]> {
    return Promise.resolve(
      [...this.memberships.values()].filter(
        (item) => item.studentProfileId === studentProfileId,
      ),
    );
  }

  findMembership(
    classId: string,
    studentProfileId: string,
  ): Promise<ClassMembershipRecord | null> {
    return Promise.resolve(
      this.memberships.get(`${classId}:${studentProfileId}`) ?? null,
    );
  }

  saveMembership(
    record: ClassMembershipRecord,
  ): Promise<ClassMembershipRecord> {
    this.memberships.set(
      `${record.classId}:${record.studentProfileId}`,
      record,
    );
    return Promise.resolve(record);
  }

  findSubmission(
    classId: string,
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<WorkSubmissionRecord | null> {
    return Promise.resolve(
      [...this.submissions.values()].find(
        (item) =>
          item.classId === classId &&
          item.studentProfileId === studentProfileId &&
          item.mainLessonId === mainLessonId,
      ) ?? null,
    );
  }

  findSubmissionById(id: string): Promise<WorkSubmissionRecord | null> {
    return Promise.resolve(this.submissions.get(id) ?? null);
  }

  listSubmissions(
    campusId: string,
    query: ListWorkSubmissionsQuery,
  ): Promise<WorkSubmissionRecord[]> {
    const records = [...this.submissions.values()].filter((item) => {
      if (item.campusId !== campusId) return false;
      if (query.status && item.status !== query.status) return false;
      if (query.classId && item.classId !== query.classId) return false;
      return true;
    });
    return Promise.resolve(
      records.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    );
  }

  listSubmissionsForStudent(
    studentProfileId: string,
  ): Promise<WorkSubmissionRecord[]> {
    return Promise.resolve(
      [...this.submissions.values()].filter(
        (item) => item.studentProfileId === studentProfileId,
      ),
    );
  }

  saveSubmission(record: WorkSubmissionRecord): Promise<WorkSubmissionRecord> {
    this.submissions.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  appendHistory(
    history: WorkSubmissionHistoryRecord,
  ): Promise<WorkSubmissionHistoryRecord> {
    const existing = this.history.get(history.workSubmissionId) ?? [];
    existing.push(history);
    this.history.set(history.workSubmissionId, existing);
    return Promise.resolve(history);
  }
}

@Injectable()
export class SubmissionsService {
  constructor(private readonly store: SubmissionStore) {}

  async joinClass(
    studentProfileId: string,
    input: JoinClassByCodeInput,
  ): Promise<ClassMembership> {
    const student = await this.requireStudent(studentProfileId);
    const classRef = await this.store.findClassByCode(input.classCode);
    if (!classRef) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '班级码无效');
    }
    if (classRef.status !== 'ACTIVE') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅可加入进行中的班级',
      );
    }
    if (classRef.campusId !== student.campusId) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '不能加入其他校区班级',
      );
    }
    const existing = await this.store.findMembership(
      classRef.id,
      studentProfileId,
    );
    if (existing) {
      return this.toMembership(classRef, existing);
    }
    const membership: ClassMembershipRecord = {
      classId: classRef.id,
      campusId: classRef.campusId,
      studentProfileId,
      joinedAt: new Date(),
    };
    await this.store.saveMembership(membership);
    return this.toMembership(classRef, membership);
  }

  async listMemberships(studentProfileId: string): Promise<ClassMembership[]> {
    const memberships = await this.store.listMemberships(studentProfileId);
    const result: ClassMembership[] = [];
    for (const membership of memberships) {
      const classRef = await this.store.findClass(membership.classId);
      if (classRef) result.push(this.toMembership(classRef, membership));
    }
    return result;
  }

  async getCurriculum(
    studentProfileId: string,
    classId: string,
  ): Promise<StudentClassCurriculum> {
    await this.requireMembership(classId, studentProfileId);
    const classRef = await this.requireClass(classId);
    const lessons = await this.store.listLessonsForVersion(
      classRef.coursePackageVersionId,
    );
    const submissions =
      await this.store.listSubmissionsForStudent(studentProfileId);
    const byLesson = new Map(
      submissions
        .filter((item) => item.classId === classId)
        .map((item) => [item.mainLessonId, item]),
    );

    const studentLessons: StudentLesson[] = lessons
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((lesson) => {
        const submission = byLesson.get(lesson.id);
        return {
          mainLessonId: lesson.id,
          sequence: lesson.sequence,
          track: lesson.track,
          title: lesson.title,
          theme: lesson.theme,
          coreDeliverable: lesson.coreDeliverable,
          learningGoals: lesson.learningGoals,
          assignment: lesson.assignment,
          submission: submission
            ? {
                id: submission.id,
                status: submission.status,
                updatedAt: submission.updatedAt.toISOString(),
              }
            : null,
        };
      });

    return {
      classId: classRef.id,
      className: classRef.name,
      campusId: classRef.campusId,
      coursePackageVersionId: classRef.coursePackageVersionId,
      coursePackageTitle: classRef.coursePackageTitle,
      coursePackageVersion: classRef.coursePackageVersion,
      lessons: studentLessons,
    };
  }

  async saveDraft(
    studentProfileId: string,
    input: SaveWorkSubmissionDraftInput,
  ): Promise<WorkSubmissionDetail> {
    await this.requireMembership(input.classId, studentProfileId);
    const classRef = await this.requireClass(input.classId);
    const lesson = await this.requireLesson(input.mainLessonId);
    if (!lesson.assignment) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '该课节没有作业模板',
      );
    }
    const validated = validateSubmissionPayloadForTrack(
      lesson.track,
      input.content,
    );
    if (!validated.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '提交内容不合法',
        validated.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    const existing = await this.store.findSubmission(
      input.classId,
      studentProfileId,
      input.mainLessonId,
    );
    if (
      existing &&
      existing.status !== 'DRAFT' &&
      existing.status !== 'NEEDS_REVISION'
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '当前状态不可修改草稿',
      );
    }

    const now = new Date();
    const record: WorkSubmissionRecord = existing
      ? {
          ...existing,
          title: validated.data.content.title,
          content: { ...validated.data.content },
          updatedAt: now,
        }
      : {
          id: randomUUID(),
          campusId: classRef.campusId,
          classId: classRef.id,
          studentProfileId,
          mainLessonId: lesson.id,
          assignmentTemplateId: lesson.assignment.id,
          track: lesson.track,
          status: 'DRAFT',
          title: validated.data.content.title,
          content: { ...validated.data.content },
          submittedAt: null,
          createdAt: now,
          updatedAt: now,
        };
    await this.store.saveSubmission(record);
    return this.toDetail(record, classRef, lesson, studentProfileId);
  }

  async transitionOwn(
    studentProfileId: string,
    submissionId: string,
    input: TransitionWorkSubmissionInput,
    actorAccountId: string,
  ): Promise<WorkSubmissionDetail> {
    const record = await this.requireOwnedSubmission(
      studentProfileId,
      submissionId,
    );
    if (
      !isStudentInitiatedSubmissionTransition(record.status, input.toStatus)
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '学生不可执行该状态流转',
      );
    }
    if (!canTransitionWorkSubmissionStatus(record.status, input.toStatus)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '作品提交状态流转不合法',
      );
    }
    return this.applyTransition(record, input, actorAccountId);
  }

  async listCampusQueue(
    campusId: string,
    query: ListWorkSubmissionsQuery,
  ): Promise<WorkSubmissionSummary[]> {
    const records = await this.store.listSubmissions(campusId, query);
    const summaries: WorkSubmissionSummary[] = [];
    for (const record of records) {
      summaries.push(await this.toSummary(record));
    }
    return summaries;
  }

  async getCampusSubmission(
    campusId: string,
    submissionId: string,
  ): Promise<WorkSubmissionDetail> {
    const record = await this.store.findSubmissionById(submissionId);
    if (!record || record.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '提交不存在');
    }
    return this.toDetail(
      record,
      await this.requireClass(record.classId),
      await this.requireLesson(record.mainLessonId),
      record.studentProfileId,
    );
  }

  async transitionCampus(
    campusId: string,
    submissionId: string,
    input: TransitionWorkSubmissionInput,
    actorAccountId: string,
  ): Promise<WorkSubmissionDetail> {
    const record = await this.store.findSubmissionById(submissionId);
    if (!record || record.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '提交不存在');
    }
    if (
      !isTeacherInitiatedSubmissionTransition(record.status, input.toStatus)
    ) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '教师不可执行该状态流转',
      );
    }
    if (!canTransitionWorkSubmissionStatus(record.status, input.toStatus)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '作品提交状态流转不合法',
      );
    }
    return this.applyTransition(record, input, actorAccountId);
  }

  private async applyTransition(
    record: WorkSubmissionRecord,
    input: TransitionWorkSubmissionInput,
    actorAccountId: string,
  ): Promise<WorkSubmissionDetail> {
    const fromStatus = record.status;
    const now = new Date();
    record.status = input.toStatus;
    record.updatedAt = now;
    if (input.toStatus === 'SUBMITTED' || input.toStatus === 'RESUBMITTED') {
      record.submittedAt = now;
    }
    await this.store.saveSubmission(record);
    await this.store.appendHistory({
      id: randomUUID(),
      campusId: record.campusId,
      workSubmissionId: record.id,
      fromStatus,
      toStatus: input.toStatus,
      changedByAccountId: actorAccountId,
      changedAt: now,
      note: input.note ?? null,
    });
    return this.toDetail(
      record,
      await this.requireClass(record.classId),
      await this.requireLesson(record.mainLessonId),
      record.studentProfileId,
    );
  }

  private async requireStudent(
    studentProfileId: string,
  ): Promise<SubmissionStudentRef> {
    const student = await this.store.findStudent(studentProfileId);
    if (!student) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '学生不存在');
    }
    return student;
  }

  private async requireClass(classId: string): Promise<SubmissionClassRef> {
    const classRef = await this.store.findClass(classId);
    if (!classRef) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '班级不存在');
    }
    return classRef;
  }

  private async requireLesson(
    mainLessonId: string,
  ): Promise<SubmissionLessonRef> {
    const lesson = await this.store.findLesson(mainLessonId);
    if (!lesson) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '课节不存在');
    }
    return lesson;
  }

  private async requireMembership(
    classId: string,
    studentProfileId: string,
  ): Promise<ClassMembershipRecord> {
    const membership = await this.store.findMembership(
      classId,
      studentProfileId,
    );
    if (!membership) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '未加入该班级');
    }
    return membership;
  }

  private async requireOwnedSubmission(
    studentProfileId: string,
    submissionId: string,
  ): Promise<WorkSubmissionRecord> {
    const record = await this.store.findSubmissionById(submissionId);
    if (!record || record.studentProfileId !== studentProfileId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '提交不存在');
    }
    return record;
  }

  private toMembership(
    classRef: SubmissionClassRef,
    membership: ClassMembershipRecord,
  ): ClassMembership {
    return {
      classId: classRef.id,
      className: classRef.name,
      classCode: classRef.classCode,
      campusId: classRef.campusId,
      status: classRef.status,
      coursePackageTitle: classRef.coursePackageTitle,
      joinedAt: membership.joinedAt.toISOString(),
    };
  }

  private async toSummary(
    record: WorkSubmissionRecord,
  ): Promise<WorkSubmissionSummary> {
    const classRef = await this.requireClass(record.classId);
    const lesson = await this.requireLesson(record.mainLessonId);
    const student = await this.requireStudent(record.studentProfileId);
    return {
      id: record.id,
      campusId: record.campusId,
      classId: record.classId,
      className: classRef.name,
      studentProfileId: record.studentProfileId,
      studentDisplayName: student.displayName,
      mainLessonId: record.mainLessonId,
      lessonSequence: lesson.sequence,
      lessonTitle: lesson.title,
      track: record.track,
      status: record.status,
      title: record.title,
      updatedAt: record.updatedAt.toISOString(),
      submittedAt: record.submittedAt?.toISOString() ?? null,
    };
  }

  private async toDetail(
    record: WorkSubmissionRecord,
    classRef: SubmissionClassRef,
    lesson: SubmissionLessonRef,
    studentProfileId: string,
  ): Promise<WorkSubmissionDetail> {
    const student = await this.requireStudent(studentProfileId);
    return {
      id: record.id,
      campusId: record.campusId,
      classId: record.classId,
      className: classRef.name,
      studentProfileId: record.studentProfileId,
      studentDisplayName: student.displayName,
      mainLessonId: record.mainLessonId,
      lessonSequence: lesson.sequence,
      lessonTitle: lesson.title,
      track: record.track,
      status: record.status,
      title: record.title,
      content: record.content,
      assignmentTemplateId: record.assignmentTemplateId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      submittedAt: record.submittedAt?.toISOString() ?? null,
    };
  }
}
