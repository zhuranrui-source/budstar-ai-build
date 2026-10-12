import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CreateCoursePackageVersionInput } from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  CoursePackageStore,
  CoursePackageVersionRecord,
  StoredMainLesson,
  StoredOnlineQa,
  StoredRubric,
} from './course-packages.service';

@Injectable()
export class PrismaCoursePackageStore implements CoursePackageStore {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CoursePackageVersionRecord[]> {
    const rows = await this.prisma.client.coursePackageVersion.findMany({
      include: {
        mainLessons: { include: { assignmentTemplate: true } },
        onlineQaSessions: true,
        rubrics: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapRow(row));
  }

  async findById(id: string): Promise<CoursePackageVersionRecord | null> {
    const row = await this.prisma.client.coursePackageVersion.findUnique({
      where: { id },
      include: {
        mainLessons: { include: { assignmentTemplate: true } },
        onlineQaSessions: true,
        rubrics: true,
      },
    });
    return row ? this.mapRow(row) : null;
  }

  async findByPackageKeyAndVersion(
    packageKey: string,
    version: string,
  ): Promise<CoursePackageVersionRecord | null> {
    const row = await this.prisma.client.coursePackageVersion.findUnique({
      where: { packageKey_version: { packageKey, version } },
      include: {
        mainLessons: { include: { assignmentTemplate: true } },
        onlineQaSessions: true,
        rubrics: true,
      },
    });
    return row ? this.mapRow(row) : null;
  }

  async save(
    record: CoursePackageVersionRecord,
  ): Promise<CoursePackageVersionRecord> {
    const existing = await this.prisma.client.coursePackageVersion.findUnique({
      where: { id: record.id },
    });
    if (existing) {
      if (existing.status === 'PUBLISHED') {
        await this.prisma.client.coursePackageVersion.update({
          where: { id: record.id },
          data: {
            status: record.status,
            publishedAt: record.publishedAt,
            updatedAt: record.updatedAt,
            title: record.title,
          },
        });
        return (await this.findById(record.id))!;
      }
      await this.prisma.client.coursePackageVersion.delete({
        where: { id: record.id },
      });
    }

    await this.prisma.client.coursePackageVersion.create({
      data: {
        id: record.id,
        packageKey: record.packageKey,
        version: record.version,
        title: record.title,
        status: record.status,
        publishedAt: record.publishedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        mainLessons: {
          create: record.mainLessons.map((lesson) => ({
            id: lesson.id,
            sequence: lesson.sequence,
            track: lesson.track,
            title: lesson.title,
            theme: lesson.theme,
            coreDeliverable: lesson.coreDeliverable,
            learningGoals: lesson.learningGoals,
            assignmentTemplate: {
              create: {
                id: lesson.assignmentId,
                title: lesson.assignment.title,
                requirements: lesson.assignment.requirements,
                submissionKinds: lesson.assignment.submissionKinds.join(','),
              },
            },
          })),
        },
        onlineQaSessions: {
          create: record.onlineQaSessions.map((session) => ({
            id: session.id,
            sequence: session.sequence,
            afterLessonSequence: session.afterLessonSequence,
            title: session.title,
            topic: session.topic,
          })),
        },
        rubrics: {
          create: record.rubrics.map((rubric) => ({
            id: rubric.id,
            name: rubric.name,
            mainLessonId: rubric.mainLessonId,
            dimensionsJson: JSON.stringify(rubric.dimensions),
          })),
        },
      },
    });
    return (await this.findById(record.id))!;
  }

  private mapRow(row: {
    id: string;
    packageKey: string;
    version: string;
    title: string;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    mainLessons: Array<{
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
    }>;
    onlineQaSessions: Array<{
      id: string;
      sequence: number;
      afterLessonSequence: number;
      title: string;
      topic: string;
    }>;
    rubrics: Array<{
      id: string;
      name: string;
      mainLessonId: string | null;
      dimensionsJson: string;
    }>;
  }): CoursePackageVersionRecord {
    const mainLessons: StoredMainLesson[] = row.mainLessons.map((lesson) => ({
      id: lesson.id,
      assignmentId: lesson.assignmentTemplate?.id ?? randomUUID(),
      sequence: lesson.sequence,
      track: lesson.track,
      title: lesson.title,
      theme: lesson.theme,
      coreDeliverable: lesson.coreDeliverable,
      learningGoals: lesson.learningGoals,
      assignment: {
        title: lesson.assignmentTemplate?.title ?? lesson.title,
        requirements: lesson.assignmentTemplate?.requirements ?? '',
        submissionKinds: (lesson.assignmentTemplate?.submissionKinds ?? '')
          .split(',')
          .filter(Boolean),
      },
    }));
    const onlineQaSessions: StoredOnlineQa[] = row.onlineQaSessions.map(
      (session) => ({
        id: session.id,
        sequence: session.sequence,
        afterLessonSequence: session.afterLessonSequence,
        title: session.title,
        topic: session.topic,
      }),
    );
    const rubrics: StoredRubric[] = row.rubrics.map((rubric) => ({
      id: rubric.id,
      name: rubric.name,
      mainLessonId: rubric.mainLessonId ?? undefined,
      dimensions: JSON.parse(
        rubric.dimensionsJson,
      ) as CreateCoursePackageVersionInput['rubrics'][number]['dimensions'],
    }));
    return {
      id: row.id,
      packageKey: row.packageKey,
      version: row.version,
      title: row.title,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      mainLessons,
      onlineQaSessions,
      rubrics,
    };
  }
}
