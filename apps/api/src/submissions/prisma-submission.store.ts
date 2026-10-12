import { Injectable } from '@nestjs/common';
import type { ListWorkSubmissionsQuery } from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  ClassMembershipRecord,
  SubmissionClassRef,
  SubmissionLessonRef,
  SubmissionStore,
  SubmissionStudentRef,
  WorkSubmissionHistoryRecord,
  WorkSubmissionRecord,
} from './submissions.service';

@Injectable()
export class PrismaSubmissionStore implements SubmissionStore {
  constructor(private readonly prisma: PrismaService) {}

  async findStudent(
    studentProfileId: string,
  ): Promise<SubmissionStudentRef | null> {
    const row = await this.prisma.client.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { id: true, campusId: true, displayName: true },
    });
    return row;
  }

  async findClass(classId: string): Promise<SubmissionClassRef | null> {
    const row = await this.prisma.client.teachingClass.findUnique({
      where: { id: classId },
      include: { coursePackageVersion: true },
    });
    return row ? this.mapClass(row) : null;
  }

  async findClassByCode(classCode: string): Promise<SubmissionClassRef | null> {
    const row = await this.prisma.client.teachingClass.findUnique({
      where: { classCode },
      include: { coursePackageVersion: true },
    });
    return row ? this.mapClass(row) : null;
  }

  async listLessonsForVersion(
    coursePackageVersionId: string,
  ): Promise<SubmissionLessonRef[]> {
    const rows = await this.prisma.client.mainLesson.findMany({
      where: { coursePackageVersionId },
      include: { assignmentTemplate: true },
      orderBy: { sequence: 'asc' },
    });
    return rows.map((row) => this.mapLesson(row));
  }

  async findLesson(mainLessonId: string): Promise<SubmissionLessonRef | null> {
    const row = await this.prisma.client.mainLesson.findUnique({
      where: { id: mainLessonId },
      include: { assignmentTemplate: true },
    });
    return row ? this.mapLesson(row) : null;
  }

  async listMemberships(
    studentProfileId: string,
  ): Promise<ClassMembershipRecord[]> {
    const rows = await this.prisma.client.classStudent.findMany({
      where: { studentProfileId },
    });
    return rows.map((row) => ({
      classId: row.classId,
      campusId: row.campusId,
      studentProfileId: row.studentProfileId,
      joinedAt: row.joinedAt,
    }));
  }

  async findMembership(
    classId: string,
    studentProfileId: string,
  ): Promise<ClassMembershipRecord | null> {
    const row = await this.prisma.client.classStudent.findUnique({
      where: {
        classId_studentProfileId: { classId, studentProfileId },
      },
    });
    return row
      ? {
          classId: row.classId,
          campusId: row.campusId,
          studentProfileId: row.studentProfileId,
          joinedAt: row.joinedAt,
        }
      : null;
  }

  async saveMembership(
    record: ClassMembershipRecord,
  ): Promise<ClassMembershipRecord> {
    await this.prisma.client.classStudent.upsert({
      where: {
        classId_studentProfileId: {
          classId: record.classId,
          studentProfileId: record.studentProfileId,
        },
      },
      create: {
        campusId: record.campusId,
        classId: record.classId,
        studentProfileId: record.studentProfileId,
        joinedAt: record.joinedAt,
      },
      update: {},
    });
    return record;
  }

  async findSubmission(
    classId: string,
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<WorkSubmissionRecord | null> {
    const row = await this.prisma.client.workSubmission.findUnique({
      where: {
        classId_studentProfileId_mainLessonId: {
          classId,
          studentProfileId,
          mainLessonId,
        },
      },
    });
    return row ? this.mapSubmission(row) : null;
  }

  async findSubmissionById(id: string): Promise<WorkSubmissionRecord | null> {
    const row = await this.prisma.client.workSubmission.findUnique({
      where: { id },
    });
    return row ? this.mapSubmission(row) : null;
  }

  async listSubmissions(
    campusId: string,
    query: ListWorkSubmissionsQuery,
  ): Promise<WorkSubmissionRecord[]> {
    const rows = await this.prisma.client.workSubmission.findMany({
      where: {
        campusId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.classId ? { classId: query.classId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.mapSubmission(row));
  }

  async listSubmissionsForStudent(
    studentProfileId: string,
  ): Promise<WorkSubmissionRecord[]> {
    const rows = await this.prisma.client.workSubmission.findMany({
      where: { studentProfileId },
    });
    return rows.map((row) => this.mapSubmission(row));
  }

  async saveSubmission(
    record: WorkSubmissionRecord,
  ): Promise<WorkSubmissionRecord> {
    await this.prisma.client.workSubmission.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        classId: record.classId,
        studentProfileId: record.studentProfileId,
        mainLessonId: record.mainLessonId,
        assignmentTemplateId: record.assignmentTemplateId,
        track: record.track,
        status: record.status,
        title: record.title,
        contentJson: JSON.stringify(record.content),
        submittedAt: record.submittedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        title: record.title,
        contentJson: JSON.stringify(record.content),
        submittedAt: record.submittedAt,
        updatedAt: record.updatedAt,
      },
    });
    return (await this.findSubmissionById(record.id))!;
  }

  async appendHistory(
    history: WorkSubmissionHistoryRecord,
  ): Promise<WorkSubmissionHistoryRecord> {
    await this.prisma.client.workSubmissionStatusHistory.create({
      data: {
        id: history.id,
        campusId: history.campusId,
        workSubmissionId: history.workSubmissionId,
        fromStatus: history.fromStatus,
        toStatus: history.toStatus,
        changedByAccountId: history.changedByAccountId,
        changedAt: history.changedAt,
        note: history.note,
      },
    });
    return history;
  }

  private mapClass(row: {
    id: string;
    campusId: string;
    name: string;
    classCode: string;
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    coursePackageVersionId: string;
    coursePackageVersion: { title: string; version: string };
  }): SubmissionClassRef {
    return {
      id: row.id,
      campusId: row.campusId,
      name: row.name,
      classCode: row.classCode,
      status: row.status,
      coursePackageVersionId: row.coursePackageVersionId,
      coursePackageTitle: row.coursePackageVersion.title,
      coursePackageVersion: row.coursePackageVersion.version,
    };
  }

  private mapLesson(row: {
    id: string;
    sequence: number;
    track: 'AIGC' | 'VIBE_CODING';
    title: string;
    theme: string;
    coreDeliverable: string;
    learningGoals: string;
    assignmentTemplate: {
      id: string;
      title: string;
      requirements: string;
      submissionKinds: string;
    } | null;
  }): SubmissionLessonRef {
    return {
      id: row.id,
      sequence: row.sequence,
      track: row.track,
      title: row.title,
      theme: row.theme,
      coreDeliverable: row.coreDeliverable,
      learningGoals: row.learningGoals,
      assignment: row.assignmentTemplate
        ? {
            id: row.assignmentTemplate.id,
            title: row.assignmentTemplate.title,
            requirements: row.assignmentTemplate.requirements,
            submissionKinds: row.assignmentTemplate.submissionKinds
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
          }
        : null,
    };
  }

  private mapSubmission(row: {
    id: string;
    campusId: string;
    classId: string;
    studentProfileId: string;
    mainLessonId: string;
    assignmentTemplateId: string;
    track: 'AIGC' | 'VIBE_CODING';
    status:
      'DRAFT' | 'SUBMITTED' | 'NEEDS_REVISION' | 'RESUBMITTED' | 'COMPLETED';
    title: string;
    contentJson: string;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): WorkSubmissionRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      mainLessonId: row.mainLessonId,
      assignmentTemplateId: row.assignmentTemplateId,
      track: row.track,
      status: row.status,
      title: row.title,
      content: JSON.parse(row.contentJson) as Record<string, unknown>,
      submittedAt: row.submittedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
