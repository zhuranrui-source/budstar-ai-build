import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  AiFeedbackDraftRecord,
  FeedbackStore,
  FeedbackSubmissionRef,
  FiveDimEvaluationRecord,
  FormalFeedbackRecord,
  GrowthReportRecord,
} from './feedback.service';
import type { GrowthDimensionScore } from '@budstar/contracts';

@Injectable()
export class PrismaFeedbackStore implements FeedbackStore {
  constructor(private readonly prisma: PrismaService) {}

  async findSubmission(id: string): Promise<FeedbackSubmissionRef | null> {
    const row = await this.prisma.client.workSubmission.findUnique({
      where: { id },
      include: {
        studentProfile: { select: { displayName: true } },
        mainLesson: { select: { sequence: true, title: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      studentDisplayName: row.studentProfile.displayName,
      mainLessonId: row.mainLessonId,
      lessonSequence: row.mainLesson.sequence,
      lessonTitle: row.mainLesson.title,
      title: row.title,
      track: row.track,
      status: row.status,
      content: JSON.parse(row.contentJson) as Record<string, unknown>,
    };
  }

  async listDrafts(workSubmissionId: string): Promise<AiFeedbackDraftRecord[]> {
    const rows = await this.prisma.client.aiFeedbackDraft.findMany({
      where: { workSubmissionId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapDraft(row));
  }

  async saveDraft(
    record: AiFeedbackDraftRecord,
  ): Promise<AiFeedbackDraftRecord> {
    const row = await this.prisma.client.aiFeedbackDraft.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        workSubmissionId: record.workSubmissionId,
        status: record.status,
        content: record.content,
        modelRoute: record.modelRoute,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        content: record.content,
        modelRoute: record.modelRoute,
        updatedAt: record.updatedAt,
      },
    });
    return this.mapDraft(row);
  }

  async findDraft(id: string): Promise<AiFeedbackDraftRecord | null> {
    const row = await this.prisma.client.aiFeedbackDraft.findUnique({
      where: { id },
    });
    return row ? this.mapDraft(row) : null;
  }

  async listFormalBySubmission(
    workSubmissionId: string,
  ): Promise<FormalFeedbackRecord[]> {
    const rows = await this.prisma.client.formalFeedback.findMany({
      where: { workSubmissionId },
      orderBy: { version: 'desc' },
    });
    return rows.map((row) => this.mapFormal(row));
  }

  async findFormal(id: string): Promise<FormalFeedbackRecord | null> {
    const row = await this.prisma.client.formalFeedback.findUnique({
      where: { id },
    });
    return row ? this.mapFormal(row) : null;
  }

  async saveFormal(
    record: FormalFeedbackRecord,
  ): Promise<FormalFeedbackRecord> {
    const row = await this.prisma.client.formalFeedback.upsert({
      where: { id: record.id },
      create: {
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
        highlightsJson: JSON.stringify(record.highlights),
        nextStepsJson: JSON.stringify(record.nextSteps),
        publishedAt: record.publishedAt,
        publishedByAccountId: record.publishedByAccountId,
        sourceAiDraftId: record.sourceAiDraftId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        body: record.body,
        highlightsJson: JSON.stringify(record.highlights),
        nextStepsJson: JSON.stringify(record.nextSteps),
        publishedAt: record.publishedAt,
        publishedByAccountId: record.publishedByAccountId,
        sourceAiDraftId: record.sourceAiDraftId,
        updatedAt: record.updatedAt,
      },
    });
    return this.mapFormal(row);
  }

  async listPublishedFormalForStudent(
    studentProfileId: string,
  ): Promise<FormalFeedbackRecord[]> {
    const rows = await this.prisma.client.formalFeedback.findMany({
      where: { studentProfileId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map((row) => this.mapFormal(row));
  }

  async findFiveDimBySubmission(
    workSubmissionId: string,
  ): Promise<FiveDimEvaluationRecord | null> {
    const row = await this.prisma.client.fiveDimEvaluation.findUnique({
      where: { workSubmissionId },
    });
    return row ? this.mapFiveDim(row) : null;
  }

  async findFiveDimById(id: string): Promise<FiveDimEvaluationRecord | null> {
    const row = await this.prisma.client.fiveDimEvaluation.findUnique({
      where: { id },
    });
    return row ? this.mapFiveDim(row) : null;
  }

  async saveFiveDim(
    record: FiveDimEvaluationRecord,
  ): Promise<FiveDimEvaluationRecord> {
    const row = await this.prisma.client.fiveDimEvaluation.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        workSubmissionId: record.workSubmissionId,
        studentProfileId: record.studentProfileId,
        status: record.status,
        scoresJson: JSON.stringify(record.scores),
        needsReview: record.needsReview,
        confirmedAt: record.confirmedAt,
        confirmedByAccountId: record.confirmedByAccountId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        scoresJson: JSON.stringify(record.scores),
        needsReview: record.needsReview,
        confirmedAt: record.confirmedAt,
        confirmedByAccountId: record.confirmedByAccountId,
        updatedAt: record.updatedAt,
      },
    });
    return this.mapFiveDim(row);
  }

  async listConfirmedFiveDimForStudent(
    studentProfileId: string,
  ): Promise<FiveDimEvaluationRecord[]> {
    const rows = await this.prisma.client.fiveDimEvaluation.findMany({
      where: { studentProfileId, status: 'CONFIRMED' },
    });
    return rows.map((row) => this.mapFiveDim(row));
  }

  async findGrowthReport(
    classId: string,
    studentProfileId: string,
    milestone: number,
  ): Promise<GrowthReportRecord | null> {
    const row = await this.prisma.client.growthReport.findUnique({
      where: {
        classId_studentProfileId_milestone: {
          classId,
          studentProfileId,
          milestone,
        },
      },
    });
    return row ? this.mapReport(row) : null;
  }

  async findGrowthReportById(id: string): Promise<GrowthReportRecord | null> {
    const row = await this.prisma.client.growthReport.findUnique({
      where: { id },
    });
    return row ? this.mapReport(row) : null;
  }

  async saveGrowthReport(
    record: GrowthReportRecord,
  ): Promise<GrowthReportRecord> {
    const row = await this.prisma.client.growthReport.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        classId: record.classId,
        studentProfileId: record.studentProfileId,
        milestone: record.milestone,
        status: record.status,
        summary: record.summary,
        teacherObservation: record.teacherObservation,
        scoresJson: JSON.stringify(record.scores),
        publishedAt: record.publishedAt,
        publishedByAccountId: record.publishedByAccountId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        summary: record.summary,
        teacherObservation: record.teacherObservation,
        scoresJson: JSON.stringify(record.scores),
        publishedAt: record.publishedAt,
        publishedByAccountId: record.publishedByAccountId,
        updatedAt: record.updatedAt,
      },
    });
    return this.mapReport(row);
  }

  async listPublishedGrowthReports(
    studentProfileId: string,
  ): Promise<GrowthReportRecord[]> {
    const rows = await this.prisma.client.growthReport.findMany({
      where: { studentProfileId, status: 'PUBLISHED' },
      orderBy: { milestone: 'desc' },
    });
    return rows.map((row) => this.mapReport(row));
  }

  private mapDraft(row: {
    id: string;
    campusId: string;
    workSubmissionId: string;
    status: AiFeedbackDraftRecord['status'];
    content: string;
    modelRoute: string;
    createdAt: Date;
    updatedAt: Date;
  }): AiFeedbackDraftRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      workSubmissionId: row.workSubmissionId,
      status: row.status,
      content: row.content,
      modelRoute: row.modelRoute as AiFeedbackDraftRecord['modelRoute'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapFormal(row: {
    id: string;
    campusId: string;
    workSubmissionId: string;
    studentProfileId: string;
    classId: string;
    mainLessonId: string;
    lessonSequence: number;
    lessonTitle: string;
    status: FormalFeedbackRecord['status'];
    version: number;
    body: string;
    highlightsJson: string;
    nextStepsJson: string;
    publishedAt: Date | null;
    publishedByAccountId: string | null;
    sourceAiDraftId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FormalFeedbackRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      workSubmissionId: row.workSubmissionId,
      studentProfileId: row.studentProfileId,
      classId: row.classId,
      mainLessonId: row.mainLessonId,
      lessonSequence: row.lessonSequence,
      lessonTitle: row.lessonTitle,
      status: row.status,
      version: row.version,
      body: row.body,
      highlights: JSON.parse(row.highlightsJson) as string[],
      nextSteps: JSON.parse(row.nextStepsJson) as string[],
      publishedAt: row.publishedAt,
      publishedByAccountId: row.publishedByAccountId,
      sourceAiDraftId: row.sourceAiDraftId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapFiveDim(row: {
    id: string;
    campusId: string;
    workSubmissionId: string;
    studentProfileId: string;
    status: FiveDimEvaluationRecord['status'];
    scoresJson: string;
    needsReview: boolean;
    confirmedAt: Date | null;
    confirmedByAccountId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): FiveDimEvaluationRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      workSubmissionId: row.workSubmissionId,
      studentProfileId: row.studentProfileId,
      status: row.status,
      scores: JSON.parse(row.scoresJson) as GrowthDimensionScore[],
      needsReview: row.needsReview,
      confirmedAt: row.confirmedAt,
      confirmedByAccountId: row.confirmedByAccountId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapReport(row: {
    id: string;
    campusId: string;
    classId: string;
    studentProfileId: string;
    milestone: number;
    status: GrowthReportRecord['status'];
    summary: string;
    teacherObservation: string | null;
    scoresJson: string;
    publishedAt: Date | null;
    publishedByAccountId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): GrowthReportRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      milestone: row.milestone as 4 | 8 | 12 | 16,
      status: row.status,
      summary: row.summary,
      teacherObservation: row.teacherObservation,
      scores: JSON.parse(row.scoresJson) as GrowthDimensionScore[],
      publishedAt: row.publishedAt,
      publishedByAccountId: row.publishedByAccountId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
