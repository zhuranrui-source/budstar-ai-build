import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  assessCommunityRisk,
  canTransitionCommunityContent,
  initialCommunityStatusForRisk,
  type CommunityContentStatus,
  type CommunityPost,
  type CommunityRiskLevel,
  type CommunityVisibilityScope,
  type CreateCommunityPostInput,
  type ReviewCommunityPostInput,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type CommunityPostRecord = {
  id: string;
  campusId: string;
  classId: string | null;
  studentProfileId: string;
  studentDisplayName: string;
  authorAccountId: string;
  title: string;
  body: string;
  visibilityScope: CommunityVisibilityScope;
  riskLevel: CommunityRiskLevel;
  status: CommunityContentStatus;
  workSubmissionId: string | null;
  reviewedAt: Date | null;
  reviewedByAccountId: string | null;
  reviewNote: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface CommunityStore {
  findStudent(studentProfileId: string): Promise<{
    id: string;
    campusId: string;
    displayName: string;
  } | null>;
  listClassIdsForStudent(studentProfileId: string): Promise<string[]>;
  savePost(record: CommunityPostRecord): Promise<CommunityPostRecord>;
  findPost(id: string): Promise<CommunityPostRecord | null>;
  listPublished(): Promise<CommunityPostRecord[]>;
  listModerationQueue(campusId: string): Promise<CommunityPostRecord[]>;
}

/** ADR-0008：作品进入公开流（CLASS/CAMPUS）需监护人展示授权；由 FamilyService 实现。 */
export interface WorkDisplayEligibilityChecker {
  getWorkDisplayEligibility(studentProfileId: string): Promise<{
    canDisplayPublicly: boolean;
    reason: string;
  }>;
}

export class InMemoryCommunityStore implements CommunityStore {
  private readonly students = new Map<
    string,
    { id: string; campusId: string; displayName: string }
  >();
  private readonly classMemberships = new Map<string, string[]>();
  private readonly posts = new Map<string, CommunityPostRecord>();

  seedStudent(student: {
    id: string;
    campusId: string;
    displayName: string;
    classIds?: string[];
  }): void {
    this.students.set(student.id, {
      id: student.id,
      campusId: student.campusId,
      displayName: student.displayName,
    });
    this.classMemberships.set(student.id, student.classIds ?? []);
  }

  findStudent(
    studentProfileId: string,
  ): Promise<{ id: string; campusId: string; displayName: string } | null> {
    const row = this.students.get(studentProfileId);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  listClassIdsForStudent(studentProfileId: string): Promise<string[]> {
    return Promise.resolve([
      ...(this.classMemberships.get(studentProfileId) ?? []),
    ]);
  }

  savePost(record: CommunityPostRecord): Promise<CommunityPostRecord> {
    this.posts.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  findPost(id: string): Promise<CommunityPostRecord | null> {
    const row = this.posts.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  listPublished(): Promise<CommunityPostRecord[]> {
    return Promise.resolve(
      [...this.posts.values()]
        .filter((post) => post.status === 'PUBLISHED')
        .sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : -1))
        .map((item) => structuredClone(item)),
    );
  }

  listModerationQueue(campusId: string): Promise<CommunityPostRecord[]> {
    return Promise.resolve(
      [...this.posts.values()]
        .filter(
          (post) =>
            post.campusId === campusId &&
            (post.status === 'PENDING_REVIEW' || post.status === 'HIDDEN'),
        )
        .map((item) => structuredClone(item)),
    );
  }
}

function isVisibleToParent(
  post: CommunityPostRecord,
  activeStudentBindings: string[],
  classIds: Set<string>,
  campusIds: Set<string>,
): boolean {
  if (post.status !== 'PUBLISHED') return false;
  if (post.visibilityScope === 'FAMILY') {
    return activeStudentBindings.includes(post.studentProfileId);
  }
  if (post.visibilityScope === 'CLASS') {
    return Boolean(post.classId && classIds.has(post.classId));
  }
  return campusIds.has(post.campusId);
}

function isVisibleToStudent(
  post: CommunityPostRecord,
  studentProfileId: string,
  campusId: string,
  classIds: string[],
): boolean {
  if (post.status !== 'PUBLISHED') return false;
  if (post.visibilityScope === 'FAMILY') {
    return post.studentProfileId === studentProfileId;
  }
  if (post.visibilityScope === 'CLASS') {
    return Boolean(post.classId && classIds.includes(post.classId));
  }
  return post.campusId === campusId;
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly store: CommunityStore,
    private readonly displayEligibility?: WorkDisplayEligibilityChecker,
  ) {}

  async createPost(
    campusId: string,
    authorAccountId: string,
    input: CreateCommunityPostInput,
  ): Promise<CommunityPost> {
    const student = await this.store.findStudent(input.studentProfileId);
    if (!student || student.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '学生不存在');
    }
    // ADR-0008：FAMILY 范围仅家人可见，无需展示授权；
    // CLASS/CAMPUS 进入站内公开流，必须持有效展示开关/存量授权。
    if (input.visibilityScope !== 'FAMILY') {
      const eligibility = this.displayEligibility
        ? await this.displayEligibility.getWorkDisplayEligibility(student.id)
        : { canDisplayPublicly: false, reason: 'WORK_DISPLAY_MISSING' };
      if (!eligibility.canDisplayPublicly) {
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'FORBIDDEN',
          '缺少监护人展示授权，内容不可进入公开流（可在家庭视图开启展示开关）',
        );
      }
    }
    const riskLevel = assessCommunityRisk(`${input.title}\n${input.body}`);
    const status = initialCommunityStatusForRisk(riskLevel);
    const now = new Date();
    const record: CommunityPostRecord = {
      id: randomUUID(),
      campusId,
      classId: input.classId ?? null,
      studentProfileId: student.id,
      studentDisplayName: student.displayName,
      authorAccountId,
      title: input.title,
      body: input.body,
      visibilityScope: input.visibilityScope,
      riskLevel,
      status,
      workSubmissionId: input.workSubmissionId ?? null,
      reviewedAt: null,
      reviewedByAccountId: null,
      reviewNote: null,
      publishedAt: status === 'PUBLISHED' ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.savePost(record);
    return this.toDto(record);
  }

  async reviewPost(
    campusId: string,
    postId: string,
    actorAccountId: string,
    input: ReviewCommunityPostInput,
  ): Promise<CommunityPost> {
    const post = await this.store.findPost(postId);
    if (!post || post.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '内容不存在');
    }
    const nextStatus: CommunityContentStatus =
      input.action === 'approve'
        ? 'PUBLISHED'
        : input.action === 'reject'
          ? 'REJECTED'
          : 'HIDDEN';
    if (!canTransitionCommunityContent(post.status, nextStatus)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '当前状态不可执行该审核动作',
      );
    }
    post.status = nextStatus;
    post.reviewedAt = new Date();
    post.reviewedByAccountId = actorAccountId;
    post.reviewNote = input.note ?? null;
    post.updatedAt = post.reviewedAt;
    if (nextStatus === 'PUBLISHED') {
      post.publishedAt = post.reviewedAt;
    }
    await this.store.savePost(post);
    return this.toDto(post);
  }

  async listModeration(campusId: string): Promise<CommunityPost[]> {
    const rows = await this.store.listModerationQueue(campusId);
    return rows.map((item) => this.toDto(item));
  }

  async listParentFeed(
    activeStudentBindings: string[],
  ): Promise<CommunityPost[]> {
    const classIds = new Set<string>();
    const campusIds = new Set<string>();
    for (const studentId of activeStudentBindings) {
      const student = await this.store.findStudent(studentId);
      if (student) campusIds.add(student.campusId);
      for (const classId of await this.store.listClassIdsForStudent(
        studentId,
      )) {
        classIds.add(classId);
      }
    }
    const published = await this.store.listPublished();
    return published
      .filter((post) =>
        isVisibleToParent(post, activeStudentBindings, classIds, campusIds),
      )
      .map((item) => this.toDto(item));
  }

  async listStudentFeed(studentProfileId: string): Promise<CommunityPost[]> {
    const student = await this.store.findStudent(studentProfileId);
    if (!student) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '学生不存在');
    }
    const classIds = await this.store.listClassIdsForStudent(studentProfileId);
    const published = await this.store.listPublished();
    return published
      .filter((post) =>
        isVisibleToStudent(post, studentProfileId, student.campusId, classIds),
      )
      .map((item) => this.toDto(item));
  }

  private toDto(record: CommunityPostRecord): CommunityPost {
    return {
      id: record.id,
      campusId: record.campusId,
      classId: record.classId,
      studentProfileId: record.studentProfileId,
      studentDisplayName: record.studentDisplayName,
      title: record.title,
      body: record.body,
      visibilityScope: record.visibilityScope,
      riskLevel: record.riskLevel,
      status: record.status,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
