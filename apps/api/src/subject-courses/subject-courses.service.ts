import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  type CreateSubjectCourseInput,
  type SubjectChapterDraft,
  type SubjectCourseDetail,
  type SubjectCourseStatus,
  type SubjectCourseSummary,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type SubjectChapterRecord = {
  id: string;
  subjectCourseId: string;
  sequence: number;
  title: string;
  contentHtml: string;
  contentUrl: string | null;
  aiGuidePrompt: string | null;
};

export type SubjectCourseRecord = {
  id: string;
  subject: string;
  gradeBand: string;
  gradeLevel: number | null;
  title: string;
  status: SubjectCourseStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  chapters: SubjectChapterRecord[];
};

export interface SubjectCourseStore {
  save(course: SubjectCourseRecord): Promise<void>;
  findById(id: string): Promise<SubjectCourseRecord | null>;
  list(): Promise<SubjectCourseRecord[]>;
}

export class InMemorySubjectCourseStore implements SubjectCourseStore {
  private readonly courses = new Map<string, SubjectCourseRecord>();

  async save(course: SubjectCourseRecord): Promise<void> {
    await Promise.resolve();
    this.courses.set(course.id, structuredClone(course));
  }

  async findById(id: string): Promise<SubjectCourseRecord | null> {
    await Promise.resolve();
    return this.courses.get(id) ?? null;
  }

  async list(): Promise<SubjectCourseRecord[]> {
    await Promise.resolve();
    return [...this.courses.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
}

@Injectable()
export class SubjectCoursesService {
  constructor(private readonly store: SubjectCourseStore) {}

  async createDraft(
    input: CreateSubjectCourseInput,
  ): Promise<SubjectCourseSummary> {
    const now = new Date();
    const id = randomUUID();
    const record: SubjectCourseRecord = {
      id,
      subject: input.subject,
      gradeBand: input.gradeBand,
      gradeLevel: input.gradeLevel ?? null,
      title: input.title,
      status: 'DRAFT',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      chapters: input.chapters.map((chapter) =>
        this.toChapterRecord(id, chapter),
      ),
    };
    await this.store.save(record);
    return this.toSummary(record);
  }

  async list(): Promise<SubjectCourseSummary[]> {
    const records = await this.store.list();
    return records.map((record) => this.toSummary(record));
  }

  async listPublished(filter?: {
    subject?: string;
    gradeBand?: string;
    gradeLevel?: number;
  }): Promise<SubjectCourseSummary[]> {
    const records = await this.store.list();
    return records
      .filter((record) => record.status === 'PUBLISHED')
      .filter((record) => !filter?.subject || record.subject === filter.subject)
      .filter(
        (record) => !filter?.gradeBand || record.gradeBand === filter.gradeBand,
      )
      .filter(
        (record) =>
          filter?.gradeLevel === undefined ||
          filter?.gradeLevel === null ||
          record.gradeLevel === filter.gradeLevel,
      )
      .map((record) => this.toSummary(record));
  }

  async get(id: string): Promise<SubjectCourseDetail> {
    return this.toDetail(await this.requireCourse(id));
  }

  async getPublished(id: string): Promise<SubjectCourseDetail> {
    const record = await this.requireCourse(id);
    if (record.status !== 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '学科内容不存在',
      );
    }
    return this.toDetail(record);
  }

  async publish(id: string): Promise<SubjectCourseSummary> {
    const record = await this.requireCourse(id);
    if (record.status === 'PUBLISHED') {
      return this.toSummary(record);
    }
    if (record.chapters.length === 0) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '没有章节的内容不能发布',
      );
    }
    record.status = 'PUBLISHED';
    record.publishedAt = new Date();
    record.updatedAt = record.publishedAt;
    await this.store.save(record);
    return this.toSummary(record);
  }

  /** DRAFT 可编辑（ADR-0003 精神：发布即不可变，改版建新记录）。 */
  async replaceChapters(
    id: string,
    chapters: SubjectChapterDraft[],
  ): Promise<SubjectCourseSummary> {
    const record = await this.requireCourse(id);
    if (record.status === 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '已发布内容不可修改；请创建新的学科内容记录',
      );
    }
    record.chapters = chapters.map((chapter) =>
      this.toChapterRecord(id, chapter),
    );
    record.updatedAt = new Date();
    await this.store.save(record);
    return this.toSummary(record);
  }

  private async requireCourse(id: string): Promise<SubjectCourseRecord> {
    const record = await this.store.findById(id);
    if (!record) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '学科内容不存在',
      );
    }
    return record;
  }

  private toChapterRecord(
    subjectCourseId: string,
    chapter: SubjectChapterDraft,
  ): SubjectChapterRecord {
    return {
      id: randomUUID(),
      subjectCourseId,
      sequence: chapter.sequence,
      title: chapter.title,
      contentHtml: chapter.contentHtml,
      contentUrl: chapter.contentUrl ?? null,
      aiGuidePrompt: chapter.aiGuidePrompt ?? null,
    };
  }

  private toSummary(record: SubjectCourseRecord): SubjectCourseSummary {
    return {
      id: record.id,
      subject: record.subject as SubjectCourseSummary['subject'],
      gradeBand: record.gradeBand as SubjectCourseSummary['gradeBand'],
      gradeLevel: record.gradeLevel,
      title: record.title,
      status: record.status,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      chapterCount: record.chapters.length,
    };
  }

  private toDetail(record: SubjectCourseRecord): SubjectCourseDetail {
    return {
      ...this.toSummary(record),
      chapters: [...record.chapters]
        .sort((a, b) => a.sequence - b.sequence)
        .map((chapter) => ({
          id: chapter.id,
          sequence: chapter.sequence,
          title: chapter.title,
          contentHtml: chapter.contentHtml,
          contentUrl: chapter.contentUrl,
          aiGuidePrompt: chapter.aiGuidePrompt,
        })),
    };
  }
}
