import { Injectable } from '@nestjs/common';
import type {
  CommunityContentStatus,
  CommunityRiskLevel,
  CommunityVisibilityScope,
} from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type { CommunityPostRecord, CommunityStore } from './community.service';

@Injectable()
export class PrismaCommunityStore implements CommunityStore {
  constructor(private readonly prisma: PrismaService) {}

  async findStudent(
    studentProfileId: string,
  ): Promise<{ id: string; campusId: string; displayName: string } | null> {
    const row = await this.prisma.client.studentProfile.findUnique({
      where: { id: studentProfileId },
      select: { id: true, campusId: true, displayName: true },
    });
    return row;
  }

  async listClassIdsForStudent(studentProfileId: string): Promise<string[]> {
    const rows = await this.prisma.client.classStudent.findMany({
      where: { studentProfileId },
      select: { classId: true },
    });
    return rows.map((row) => row.classId);
  }

  async savePost(record: CommunityPostRecord): Promise<CommunityPostRecord> {
    const row = await this.prisma.client.communityPost.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        classId: record.classId,
        studentProfileId: record.studentProfileId,
        authorAccountId: record.authorAccountId,
        title: record.title,
        body: record.body,
        visibilityScope: record.visibilityScope,
        riskLevel: record.riskLevel,
        status: record.status,
        workSubmissionId: record.workSubmissionId,
        reviewedAt: record.reviewedAt,
        reviewedByAccountId: record.reviewedByAccountId,
        reviewNote: record.reviewNote,
        publishedAt: record.publishedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        riskLevel: record.riskLevel,
        reviewedAt: record.reviewedAt,
        reviewedByAccountId: record.reviewedByAccountId,
        reviewNote: record.reviewNote,
        publishedAt: record.publishedAt,
        updatedAt: record.updatedAt,
      },
      include: {
        studentProfile: { select: { displayName: true } },
      },
    });
    return this.map(row);
  }

  async findPost(id: string): Promise<CommunityPostRecord | null> {
    const row = await this.prisma.client.communityPost.findUnique({
      where: { id },
      include: { studentProfile: { select: { displayName: true } } },
    });
    return row ? this.map(row) : null;
  }

  async listPublished(): Promise<CommunityPostRecord[]> {
    const rows = await this.prisma.client.communityPost.findMany({
      where: { status: 'PUBLISHED' },
      include: { studentProfile: { select: { displayName: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    return rows.map((row) => this.map(row));
  }

  async listModerationQueue(campusId: string): Promise<CommunityPostRecord[]> {
    const rows = await this.prisma.client.communityPost.findMany({
      where: {
        campusId,
        status: { in: ['PENDING_REVIEW', 'HIDDEN'] },
      },
      include: { studentProfile: { select: { displayName: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.map(row));
  }

  private map(row: {
    id: string;
    campusId: string;
    classId: string | null;
    studentProfileId: string;
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
    studentProfile: { displayName: string };
  }): CommunityPostRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      studentDisplayName: row.studentProfile.displayName,
      authorAccountId: row.authorAccountId,
      title: row.title,
      body: row.body,
      visibilityScope: row.visibilityScope,
      riskLevel: row.riskLevel,
      status: row.status,
      workSubmissionId: row.workSubmissionId,
      reviewedAt: row.reviewedAt,
      reviewedByAccountId: row.reviewedByAccountId,
      reviewNote: row.reviewNote,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
