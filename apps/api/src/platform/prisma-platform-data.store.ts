import { Injectable } from '@nestjs/common';
import type { PlatformBrowsableEntity } from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  PlatformBrowseRow,
  PlatformDataStore,
} from './platform-admin.service';

@Injectable()
export class PrismaPlatformDataStore implements PlatformDataStore {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    entity: PlatformBrowsableEntity,
    campusId: string | undefined,
    limit: number,
  ): Promise<PlatformBrowseRow[]> {
    switch (entity) {
      case 'campus': {
        const rows = await this.prisma.client.campus.findMany({
          where: campusId ? { id: campusId } : undefined,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          createdAt: row.createdAt.toISOString(),
        }));
      }
      case 'appointment_lead': {
        const rows = await this.prisma.client.appointmentLead.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          parentName: row.parentName,
          phone: row.phone,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }));
      }
      case 'teaching_class': {
        const rows = await this.prisma.client.teachingClass.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          name: row.name,
          classCode: row.classCode,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }));
      }
      case 'work_submission': {
        const rows = await this.prisma.client.workSubmission.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          classId: row.classId,
          studentProfileId: row.studentProfileId,
          status: row.status,
          title: row.title,
          updatedAt: row.updatedAt.toISOString(),
        }));
      }
      case 'formal_feedback': {
        const rows = await this.prisma.client.formalFeedback.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          studentProfileId: row.studentProfileId,
          status: row.status,
          version: row.version,
          publishedAt: row.publishedAt?.toISOString() ?? null,
        }));
      }
      case 'growth_report': {
        const rows = await this.prisma.client.growthReport.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          studentProfileId: row.studentProfileId,
          milestone: row.milestone,
          status: row.status,
          publishedAt: row.publishedAt?.toISOString() ?? null,
        }));
      }
      case 'community_post': {
        const rows = await this.prisma.client.communityPost.findMany({
          where: campusId ? { campusId } : undefined,
          take: limit,
          orderBy: { updatedAt: 'desc' },
        });
        return rows.map((row) => ({
          id: row.id,
          campusId: row.campusId,
          studentProfileId: row.studentProfileId,
          visibilityScope: row.visibilityScope,
          riskLevel: row.riskLevel,
          status: row.status,
          publishedAt: row.publishedAt?.toISOString() ?? null,
        }));
      }
      default: {
        const _exhaustive: never = entity;
        return _exhaustive;
      }
    }
  }
}
