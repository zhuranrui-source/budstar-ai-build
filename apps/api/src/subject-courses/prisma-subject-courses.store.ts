import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  SubjectCourseRecord,
  SubjectCourseStore,
} from './subject-courses.service';
import type { SubjectCourseStatus } from '@budstar/contracts';

@Injectable()
export class PrismaSubjectCourseStore implements SubjectCourseStore {
  constructor(private readonly prisma: PrismaService) {}

  async save(course: SubjectCourseRecord): Promise<void> {
    await this.prisma.client.subjectCourse.upsert({
      where: { id: course.id },
      create: {
        id: course.id,
        subject: course.subject,
        gradeBand: course.gradeBand,
        gradeLevel: course.gradeLevel,
        title: course.title,
        status: course.status,
        publishedAt: course.publishedAt,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        chapters: {
          create: course.chapters.map((chapter) => ({
            id: chapter.id,
            sequence: chapter.sequence,
            title: chapter.title,
            contentHtml: chapter.contentHtml,
            contentUrl: chapter.contentUrl,
            aiGuidePrompt: chapter.aiGuidePrompt,
          })),
        },
      },
      update: {
        subject: course.subject,
        gradeBand: course.gradeBand,
        gradeLevel: course.gradeLevel,
        title: course.title,
        status: course.status,
        publishedAt: course.publishedAt,
        updatedAt: course.updatedAt,
      },
    });
    if (course.status === 'DRAFT') {
      // 草稿章节可整体替换：先清后写
      await this.prisma.client.subjectChapter.deleteMany({
        where: { subjectCourseId: course.id },
      });
      for (const chapter of course.chapters) {
        await this.prisma.client.subjectChapter.create({ data: chapter });
      }
    }
  }

  async findById(id: string): Promise<SubjectCourseRecord | null> {
    const row = await this.prisma.client.subjectCourse.findUnique({
      where: { id },
      include: { chapters: true },
    });
    return row ? this.toRecord(row) : null;
  }

  async list(): Promise<SubjectCourseRecord[]> {
    const rows = await this.prisma.client.subjectCourse.findMany({
      include: { chapters: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: {
    id: string;
    subject: string;
    gradeBand: string;
    gradeLevel: number | null;
    title: string;
    status: SubjectCourseStatus;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    chapters: Array<{
      id: string;
      subjectCourseId: string;
      sequence: number;
      title: string;
      contentHtml: string;
      contentUrl: string | null;
      aiGuidePrompt: string | null;
    }>;
  }): SubjectCourseRecord {
    return {
      id: row.id,
      subject: row.subject,
      gradeBand: row.gradeBand,
      gradeLevel: row.gradeLevel,
      title: row.title,
      status: row.status,
      publishedAt: row.publishedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      chapters: row.chapters.map((chapter) => ({
        ...chapter,
        contentUrl: chapter.contentUrl ?? null,
      })),
    };
  }
}
