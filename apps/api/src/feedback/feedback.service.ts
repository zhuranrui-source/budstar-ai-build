import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  GROWTH_DIMENSION_LABELS,
  assertNoNumericLevelsForStudent,
  buildWechatLessonReportCopy,
  canPublishFormalFeedback,
  canTransitionAiFeedbackDraft,
  canTransitionFiveDimEvaluation,
  canTransitionGrowthReport,
  growthDimensionKeys,
  toStudentBadges,
  type AiFeedbackDraft,
  type AiFeedbackDraftStatus,
  type FiveDimEvaluation,
  type FiveDimEvaluationStatus,
  type FormalFeedback,
  type FormalFeedbackStatus,
  type GenerateGrowthReportInput,
  type GrowthDimensionScore,
  type GrowthReport,
  type GrowthReportStatus,
  type LessonReportCopy,
  type ParentGrowthView,
  type PublishFormalFeedbackInput,
  type PublishGrowthReportInput,
  type ReviewFiveDimEvaluationInput,
  type SaveFormalFeedbackDraftInput,
  type StudentGrowthView,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type FeedbackSubmissionRef = {
  id: string;
  campusId: string;
  classId: string;
  studentProfileId: string;
  studentDisplayName: string;
  mainLessonId: string;
  lessonSequence: number;
  lessonTitle: string;
  title: string;
  track: 'AIGC' | 'VIBE_CODING';
  status: string;
  content: Record<string, unknown>;
};

export type AiFeedbackDraftRecord = {
  id: string;
  campusId: string;
  workSubmissionId: string;
  status: AiFeedbackDraftStatus;
  content: string;
  modelRoute: 'primary' | 'fallback' | 'mock' | 'manual';
  createdAt: Date;
  updatedAt: Date;
};

export type FormalFeedbackRecord = {
  id: string;
  campusId: string;
  workSubmissionId: string;
  studentProfileId: string;
  classId: string;
  mainLessonId: string;
  lessonSequence: number;
  lessonTitle: string;
  status: FormalFeedbackStatus;
  version: number;
  body: string;
  highlights: string[];
  nextSteps: string[];
  publishedAt: Date | null;
  publishedByAccountId: string | null;
  sourceAiDraftId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FiveDimEvaluationRecord = {
  id: string;
  campusId: string;
  workSubmissionId: string;
  studentProfileId: string;
  status: FiveDimEvaluationStatus;
  scores: GrowthDimensionScore[];
  needsReview: boolean;
  confirmedAt: Date | null;
  confirmedByAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GrowthReportRecord = {
  id: string;
  campusId: string;
  classId: string;
  studentProfileId: string;
  milestone: 4 | 8 | 12 | 16;
  status: GrowthReportStatus;
  summary: string;
  teacherObservation: string | null;
  scores: GrowthDimensionScore[];
  publishedAt: Date | null;
  publishedByAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface FeedbackStore {
  findSubmission(id: string): Promise<FeedbackSubmissionRef | null>;
  listDrafts(workSubmissionId: string): Promise<AiFeedbackDraftRecord[]>;
  saveDraft(record: AiFeedbackDraftRecord): Promise<AiFeedbackDraftRecord>;
  findDraft(id: string): Promise<AiFeedbackDraftRecord | null>;
  listFormalBySubmission(
    workSubmissionId: string,
  ): Promise<FormalFeedbackRecord[]>;
  findFormal(id: string): Promise<FormalFeedbackRecord | null>;
  saveFormal(record: FormalFeedbackRecord): Promise<FormalFeedbackRecord>;
  listPublishedFormalForStudent(
    studentProfileId: string,
  ): Promise<FormalFeedbackRecord[]>;
  findFiveDimBySubmission(
    workSubmissionId: string,
  ): Promise<FiveDimEvaluationRecord | null>;
  findFiveDimById(id: string): Promise<FiveDimEvaluationRecord | null>;
  saveFiveDim(
    record: FiveDimEvaluationRecord,
  ): Promise<FiveDimEvaluationRecord>;
  listConfirmedFiveDimForStudent(
    studentProfileId: string,
  ): Promise<FiveDimEvaluationRecord[]>;
  findGrowthReport(
    classId: string,
    studentProfileId: string,
    milestone: number,
  ): Promise<GrowthReportRecord | null>;
  findGrowthReportById(id: string): Promise<GrowthReportRecord | null>;
  saveGrowthReport(record: GrowthReportRecord): Promise<GrowthReportRecord>;
  listPublishedGrowthReports(
    studentProfileId: string,
  ): Promise<GrowthReportRecord[]>;
}

export class InMemoryFeedbackStore implements FeedbackStore {
  private readonly submissions = new Map<string, FeedbackSubmissionRef>();
  private readonly drafts = new Map<string, AiFeedbackDraftRecord>();
  private readonly formals = new Map<string, FormalFeedbackRecord>();
  private readonly fiveDims = new Map<string, FiveDimEvaluationRecord>();
  private readonly reports = new Map<string, GrowthReportRecord>();

  seedSubmission(submission: FeedbackSubmissionRef): void {
    this.submissions.set(submission.id, structuredClone(submission));
  }

  findSubmission(id: string): Promise<FeedbackSubmissionRef | null> {
    const row = this.submissions.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  listDrafts(workSubmissionId: string): Promise<AiFeedbackDraftRecord[]> {
    return Promise.resolve(
      [...this.drafts.values()]
        .filter((item) => item.workSubmissionId === workSubmissionId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((item) => structuredClone(item)),
    );
  }

  saveDraft(record: AiFeedbackDraftRecord): Promise<AiFeedbackDraftRecord> {
    this.drafts.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  findDraft(id: string): Promise<AiFeedbackDraftRecord | null> {
    const row = this.drafts.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  listFormalBySubmission(
    workSubmissionId: string,
  ): Promise<FormalFeedbackRecord[]> {
    return Promise.resolve(
      [...this.formals.values()]
        .filter((item) => item.workSubmissionId === workSubmissionId)
        .sort((a, b) => b.version - a.version)
        .map((item) => structuredClone(item)),
    );
  }

  findFormal(id: string): Promise<FormalFeedbackRecord | null> {
    const row = this.formals.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  saveFormal(record: FormalFeedbackRecord): Promise<FormalFeedbackRecord> {
    this.formals.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  listPublishedFormalForStudent(
    studentProfileId: string,
  ): Promise<FormalFeedbackRecord[]> {
    return Promise.resolve(
      [...this.formals.values()]
        .filter(
          (item) =>
            item.studentProfileId === studentProfileId &&
            item.status === 'PUBLISHED',
        )
        .sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : -1))
        .map((item) => structuredClone(item)),
    );
  }

  findFiveDimBySubmission(
    workSubmissionId: string,
  ): Promise<FiveDimEvaluationRecord | null> {
    const row = [...this.fiveDims.values()].find(
      (item) => item.workSubmissionId === workSubmissionId,
    );
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  findFiveDimById(id: string): Promise<FiveDimEvaluationRecord | null> {
    const row = this.fiveDims.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  saveFiveDim(
    record: FiveDimEvaluationRecord,
  ): Promise<FiveDimEvaluationRecord> {
    this.fiveDims.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  listConfirmedFiveDimForStudent(
    studentProfileId: string,
  ): Promise<FiveDimEvaluationRecord[]> {
    return Promise.resolve(
      [...this.fiveDims.values()]
        .filter(
          (item) =>
            item.studentProfileId === studentProfileId &&
            item.status === 'CONFIRMED',
        )
        .map((item) => structuredClone(item)),
    );
  }

  findGrowthReport(
    classId: string,
    studentProfileId: string,
    milestone: number,
  ): Promise<GrowthReportRecord | null> {
    const row = [...this.reports.values()].find(
      (item) =>
        item.classId === classId &&
        item.studentProfileId === studentProfileId &&
        item.milestone === milestone,
    );
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  findGrowthReportById(id: string): Promise<GrowthReportRecord | null> {
    const row = this.reports.get(id);
    return Promise.resolve(row ? structuredClone(row) : null);
  }

  saveGrowthReport(record: GrowthReportRecord): Promise<GrowthReportRecord> {
    this.reports.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }

  listPublishedGrowthReports(
    studentProfileId: string,
  ): Promise<GrowthReportRecord[]> {
    return Promise.resolve(
      [...this.reports.values()]
        .filter(
          (item) =>
            item.studentProfileId === studentProfileId &&
            item.status === 'PUBLISHED',
        )
        .sort((a, b) => b.milestone - a.milestone)
        .map((item) => structuredClone(item)),
    );
  }
}

function buildMockDraftContent(submission: FeedbackSubmissionRef): string {
  return [
    `针对「${submission.title}」的点评草稿（不会自动发布）：`,
    `课节：第${submission.lessonSequence}节 ${submission.lessonTitle}`,
    '建议肯定学生的目标拆解与表达，并给出 1–2 个可执行的下一步。',
    '请教师审阅后编辑再正式发布。',
  ].join('\n');
}

function buildMockScores(
  submission: FeedbackSubmissionRef,
): GrowthDimensionScore[] {
  return growthDimensionKeys.map((dimension, index) => ({
    dimension,
    level: ((index + submission.lessonSequence) % 5) + 1,
    rationale: `基于作品「${submission.title}」在「${GROWTH_DIMENSION_LABELS[dimension]}」维度的观察草稿，待人工确认。`,
  }));
}

@Injectable()
export class FeedbackService {
  constructor(private readonly store: FeedbackStore) {}

  async generateAiDraft(
    campusId: string,
    workSubmissionId: string,
  ): Promise<AiFeedbackDraft> {
    const submission = await this.requireCampusSubmission(
      campusId,
      workSubmissionId,
    );
    const now = new Date();
    const draft: AiFeedbackDraftRecord = {
      id: randomUUID(),
      campusId,
      workSubmissionId: submission.id,
      status: 'GENERATING',
      content: '',
      modelRoute: 'mock',
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveDraft(draft);
    // ADR-0004: generation stops at GENERATED; never publishes.
    draft.status = 'GENERATED';
    draft.content = buildMockDraftContent(submission);
    draft.updatedAt = new Date();
    await this.store.saveDraft(draft);
    return this.toDraftDto(draft);
  }

  async listDrafts(
    campusId: string,
    workSubmissionId: string,
  ): Promise<AiFeedbackDraft[]> {
    await this.requireCampusSubmission(campusId, workSubmissionId);
    const drafts = await this.store.listDrafts(workSubmissionId);
    return drafts.map((item) => this.toDraftDto(item));
  }

  async saveFormalDraft(
    campusId: string,
    actorAccountId: string,
    input: SaveFormalFeedbackDraftInput,
  ): Promise<FormalFeedback> {
    void actorAccountId;
    const submission = await this.requireCampusSubmission(
      campusId,
      input.workSubmissionId,
    );
    const existing = await this.store.listFormalBySubmission(submission.id);
    const latestDraft = existing.find((item) => item.status === 'DRAFT');
    const latestPublished = existing.find(
      (item) => item.status === 'PUBLISHED',
    );

    if (input.aiDraftId) {
      const draft = await this.store.findDraft(input.aiDraftId);
      if (!draft || draft.campusId !== campusId) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '草稿不存在');
      }
      if (
        !canTransitionAiFeedbackDraft(draft.status, 'ADOPTED') &&
        draft.status !== 'ADOPTED'
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          'AI 草稿状态不可采用',
        );
      }
      if (draft.status !== 'ADOPTED') {
        draft.status = 'ADOPTED';
        draft.updatedAt = new Date();
        await this.store.saveDraft(draft);
      }
    }

    const now = new Date();
    if (latestDraft) {
      latestDraft.body = input.body;
      latestDraft.highlights = input.highlights;
      latestDraft.nextSteps = input.nextSteps;
      latestDraft.sourceAiDraftId =
        input.aiDraftId ?? latestDraft.sourceAiDraftId;
      latestDraft.updatedAt = now;
      await this.store.saveFormal(latestDraft);
      return this.toFormalDto(latestDraft);
    }

    const record: FormalFeedbackRecord = {
      id: randomUUID(),
      campusId,
      workSubmissionId: submission.id,
      studentProfileId: submission.studentProfileId,
      classId: submission.classId,
      mainLessonId: submission.mainLessonId,
      lessonSequence: submission.lessonSequence,
      lessonTitle: submission.lessonTitle,
      status: 'DRAFT',
      version: latestPublished ? latestPublished.version + 1 : 1,
      body: input.body,
      highlights: input.highlights,
      nextSteps: input.nextSteps,
      publishedAt: null,
      publishedByAccountId: null,
      sourceAiDraftId: input.aiDraftId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveFormal(record);
    return this.toFormalDto(record);
  }

  async publishFormal(
    campusId: string,
    formalFeedbackId: string,
    actorAccountId: string,
    input: PublishFormalFeedbackInput,
  ): Promise<FormalFeedback> {
    void input;
    const formal = await this.requireCampusFormal(campusId, formalFeedbackId);
    if (!canPublishFormalFeedback(formal.status)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅草稿状态的正式点评可发布，禁止自动发布',
      );
    }
    formal.status = 'PUBLISHED';
    formal.publishedAt = new Date();
    formal.publishedByAccountId = actorAccountId;
    formal.updatedAt = formal.publishedAt;
    await this.store.saveFormal(formal);
    return this.toFormalDto(formal);
  }

  async generateFiveDim(
    campusId: string,
    workSubmissionId: string,
  ): Promise<FiveDimEvaluation> {
    const submission = await this.requireCampusSubmission(
      campusId,
      workSubmissionId,
    );
    const existing = await this.store.findFiveDimBySubmission(submission.id);
    const now = new Date();
    const scores = buildMockScores(submission);
    if (existing) {
      if (existing.status === 'CONFIRMED') {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          '已确认的五维评价不可重新生成',
        );
      }
      if (
        !canTransitionFiveDimEvaluation(existing.status, 'GENERATED') &&
        existing.status !== 'GENERATED'
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          '五维评价状态不允许重新生成',
        );
      }
      existing.status = 'GENERATED';
      existing.scores = scores;
      existing.needsReview = false;
      existing.updatedAt = now;
      await this.store.saveFiveDim(existing);
      return this.toFiveDimDto(existing);
    }
    const record: FiveDimEvaluationRecord = {
      id: randomUUID(),
      campusId,
      workSubmissionId: submission.id,
      studentProfileId: submission.studentProfileId,
      status: 'GENERATED',
      scores,
      needsReview: false,
      confirmedAt: null,
      confirmedByAccountId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveFiveDim(record);
    return this.toFiveDimDto(record);
  }

  async reviewFiveDim(
    campusId: string,
    evaluationId: string,
    actorAccountId: string,
    input: ReviewFiveDimEvaluationInput,
  ): Promise<FiveDimEvaluation> {
    const evaluation = await this.store.findFiveDimById(evaluationId);
    if (!evaluation || evaluation.campusId !== campusId) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '五维评价不存在',
      );
    }
    if (input.action === 'mark_review') {
      if (
        !canTransitionFiveDimEvaluation(evaluation.status, 'PENDING_REVIEW')
      ) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          '当前状态不可标记复核',
        );
      }
      evaluation.status = 'PENDING_REVIEW';
      evaluation.needsReview = true;
      evaluation.updatedAt = new Date();
      await this.store.saveFiveDim(evaluation);
      return this.toFiveDimDto(evaluation);
    }
    if (!canTransitionFiveDimEvaluation(evaluation.status, 'CONFIRMED')) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '当前状态不可确认；确认须人工操作',
      );
    }
    evaluation.status = 'CONFIRMED';
    evaluation.needsReview = false;
    evaluation.confirmedAt = new Date();
    evaluation.confirmedByAccountId = actorAccountId;
    evaluation.updatedAt = evaluation.confirmedAt;
    await this.store.saveFiveDim(evaluation);
    return this.toFiveDimDto(evaluation);
  }

  async generateGrowthReport(
    campusId: string,
    input: GenerateGrowthReportInput,
  ): Promise<GrowthReport> {
    const existing = await this.store.findGrowthReport(
      input.classId,
      input.studentProfileId,
      input.milestone,
    );
    if (existing?.status === 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '已发布成长报告不可重新生成',
      );
    }
    const confirmed = await this.store.listConfirmedFiveDimForStudent(
      input.studentProfileId,
    );
    const scores =
      confirmed[0]?.scores ??
      growthDimensionKeys.map((dimension) => ({
        dimension,
        level: 3,
        rationale: `第${input.milestone}节阶段草稿依据，待人工审核发布。`,
      }));
    const now = new Date();
    const summary = `第${input.milestone}节阶段成长报告草稿：汇总已确认的五维评价与课堂观察，须人工审核后发布。`;
    if (existing) {
      if (!canTransitionGrowthReport(existing.status, 'DRAFT_GENERATING')) {
        existing.status = 'DRAFT_GENERATING';
      } else {
        existing.status = 'DRAFT_GENERATING';
      }
      existing.summary = summary;
      existing.scores = scores;
      existing.status = 'PENDING_REVIEW';
      existing.updatedAt = now;
      await this.store.saveGrowthReport(existing);
      return this.toReportDto(existing);
    }
    const record: GrowthReportRecord = {
      id: randomUUID(),
      campusId,
      classId: input.classId,
      studentProfileId: input.studentProfileId,
      milestone: input.milestone,
      status: 'PENDING_REVIEW',
      summary,
      teacherObservation: null,
      scores,
      publishedAt: null,
      publishedByAccountId: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveGrowthReport(record);
    return this.toReportDto(record);
  }

  async publishGrowthReport(
    campusId: string,
    reportId: string,
    actorAccountId: string,
    input: PublishGrowthReportInput,
  ): Promise<GrowthReport> {
    const report = await this.requireCampusReport(campusId, reportId);
    if (!canTransitionGrowthReport(report.status, 'PUBLISHED')) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅待审核草稿可人工发布，禁止自动发布',
      );
    }
    if (input.teacherObservation !== undefined) {
      report.teacherObservation = input.teacherObservation;
    }
    report.status = 'PUBLISHED';
    report.publishedAt = new Date();
    report.publishedByAccountId = actorAccountId;
    report.updatedAt = report.publishedAt;
    await this.store.saveGrowthReport(report);
    return this.toReportDto(report);
  }

  async getLessonReportCopy(
    campusId: string,
    formalFeedbackId: string,
  ): Promise<LessonReportCopy> {
    const formal = await this.requireCampusFormal(campusId, formalFeedbackId);
    if (formal.status !== 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅已发布正式点评可生成每课一报',
      );
    }
    const submission = await this.requireCampusSubmission(
      campusId,
      formal.workSubmissionId,
    );
    return {
      formalFeedbackId: formal.id,
      structured: {
        lessonTitle: formal.lessonTitle,
        body: formal.body,
        highlights: formal.highlights,
        nextSteps: formal.nextSteps,
      },
      wechatCopy: buildWechatLessonReportCopy({
        studentDisplayName: submission.studentDisplayName,
        lessonTitle: formal.lessonTitle,
        lessonSequence: formal.lessonSequence,
        body: formal.body,
        highlights: formal.highlights,
        nextSteps: formal.nextSteps,
      }),
    };
  }

  async getStudentGrowthView(
    studentProfileId: string,
  ): Promise<StudentGrowthView> {
    const published =
      await this.store.listPublishedFormalForStudent(studentProfileId);
    const confirmed =
      await this.store.listConfirmedFiveDimForStudent(studentProfileId);
    const badges = toStudentBadges(confirmed.flatMap((item) => item.scores));
    const view: StudentGrowthView = {
      studentProfileId,
      badges,
      publishedFeedback: published.map((item) => ({
        id: item.id,
        lessonTitle: item.lessonTitle,
        lessonSequence: item.lessonSequence,
        body: item.body,
        highlights: item.highlights,
        nextSteps: item.nextSteps,
        publishedAt: item.publishedAt!.toISOString(),
      })),
    };
    assertNoNumericLevelsForStudent(view);
    return view;
  }

  async getParentGrowthView(
    studentProfileId: string,
  ): Promise<ParentGrowthView> {
    const published =
      await this.store.listPublishedFormalForStudent(studentProfileId);
    const confirmed =
      await this.store.listConfirmedFiveDimForStudent(studentProfileId);
    const reports =
      await this.store.listPublishedGrowthReports(studentProfileId);
    const stripLevel = (
      scores: Array<{ dimension: string; rationale: string }>,
    ) => scores.map(({ dimension, rationale }) => ({ dimension, rationale }));
    return {
      studentProfileId,
      publishedFeedback: published.map((item) => this.toFormalDto(item)),
      confirmedEvaluations: confirmed.map((item) => ({
        id: item.id,
        scores: stripLevel(item.scores),
      })),
      publishedReports: reports.map((item) => ({
        id: item.id,
        milestone: item.milestone,
        summary: item.summary,
        teacherObservation: item.teacherObservation,
        scores: stripLevel(item.scores),
        publishedAt: item.publishedAt!.toISOString(),
      })),
    };
  }

  private async requireCampusSubmission(
    campusId: string,
    workSubmissionId: string,
  ): Promise<FeedbackSubmissionRef> {
    const submission = await this.store.findSubmission(workSubmissionId);
    if (!submission || submission.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '提交不存在');
    }
    return submission;
  }

  private async requireCampusFormal(
    campusId: string,
    formalFeedbackId: string,
  ): Promise<FormalFeedbackRecord> {
    const formal = await this.store.findFormal(formalFeedbackId);
    if (!formal || formal.campusId !== campusId) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '正式点评不存在',
      );
    }
    return formal;
  }

  private async requireCampusReport(
    campusId: string,
    reportId: string,
  ): Promise<GrowthReportRecord> {
    const report = await this.store.findGrowthReportById(reportId);
    if (!report || report.campusId !== campusId) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '成长报告不存在',
      );
    }
    return report;
  }

  private toDraftDto(record: AiFeedbackDraftRecord): AiFeedbackDraft {
    return {
      id: record.id,
      campusId: record.campusId,
      workSubmissionId: record.workSubmissionId,
      status: record.status,
      content: record.content,
      modelRoute: record.modelRoute,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toFormalDto(record: FormalFeedbackRecord): FormalFeedback {
    return {
      id: record.id,
      campusId: record.campusId,
      workSubmissionId: record.workSubmissionId,
      studentProfileId: record.studentProfileId,
      classId: record.classId,
      mainLessonId: record.mainLessonId,
      lessonSequence: record.lessonSequence,
      lessonTitle: record.lessonTitle,
      status: record.status,
      version: record.version,
      body: record.body,
      highlights: record.highlights,
      nextSteps: record.nextSteps,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      publishedByAccountId: record.publishedByAccountId,
      sourceAiDraftId: record.sourceAiDraftId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toFiveDimDto(record: FiveDimEvaluationRecord): FiveDimEvaluation {
    return {
      id: record.id,
      campusId: record.campusId,
      workSubmissionId: record.workSubmissionId,
      studentProfileId: record.studentProfileId,
      status: record.status,
      scores: record.scores,
      needsReview: record.needsReview,
      confirmedAt: record.confirmedAt?.toISOString() ?? null,
      confirmedByAccountId: record.confirmedByAccountId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toReportDto(record: GrowthReportRecord): GrowthReport {
    return {
      id: record.id,
      campusId: record.campusId,
      classId: record.classId,
      studentProfileId: record.studentProfileId,
      milestone: record.milestone,
      status: record.status,
      summary: record.summary,
      teacherObservation: record.teacherObservation,
      scores: record.scores,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      publishedByAccountId: record.publishedByAccountId,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
