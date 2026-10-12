import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CoursePackageVersionStatus,
  CoursePackageVersionSummary,
  CreateCoursePackageVersionInput,
  ReviseCoursePackageVersionInput,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type StoredMainLesson =
  CreateCoursePackageVersionInput['mainLessons'][number] & {
    id: string;
    assignmentId: string;
  };

export type StoredOnlineQa =
  CreateCoursePackageVersionInput['onlineQaSessions'][number] & {
    id: string;
  };

export type StoredRubric =
  CreateCoursePackageVersionInput['rubrics'][number] & {
    id: string;
    mainLessonId?: string;
  };

export type CoursePackageVersionRecord = {
  id: string;
  packageKey: string;
  version: string;
  title: string;
  status: CoursePackageVersionStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  mainLessons: StoredMainLesson[];
  onlineQaSessions: StoredOnlineQa[];
  rubrics: StoredRubric[];
};

export interface CoursePackageStore {
  list(): Promise<CoursePackageVersionRecord[]>;
  findById(id: string): Promise<CoursePackageVersionRecord | null>;
  findByPackageKeyAndVersion(
    packageKey: string,
    version: string,
  ): Promise<CoursePackageVersionRecord | null>;
  save(record: CoursePackageVersionRecord): Promise<CoursePackageVersionRecord>;
}

export class InMemoryCoursePackageStore implements CoursePackageStore {
  private readonly versions = new Map<string, CoursePackageVersionRecord>();

  list(): Promise<CoursePackageVersionRecord[]> {
    return Promise.resolve(
      [...this.versions.values()].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      ),
    );
  }

  findById(id: string): Promise<CoursePackageVersionRecord | null> {
    return Promise.resolve(this.versions.get(id) ?? null);
  }

  findByPackageKeyAndVersion(
    packageKey: string,
    version: string,
  ): Promise<CoursePackageVersionRecord | null> {
    return Promise.resolve(
      [...this.versions.values()].find(
        (item) => item.packageKey === packageKey && item.version === version,
      ) ?? null,
    );
  }

  save(
    record: CoursePackageVersionRecord,
  ): Promise<CoursePackageVersionRecord> {
    this.versions.set(record.id, structuredClone(record));
    return Promise.resolve(structuredClone(record));
  }
}

@Injectable()
export class CoursePackagesService {
  constructor(private readonly store: CoursePackageStore) {}

  async list(): Promise<CoursePackageVersionSummary[]> {
    const records = await this.store.list();
    return records.map((record) => this.toSummary(record));
  }

  /** ADR-0009：合作方仅可见已发布版本的内容目录。 */
  async listPublished(): Promise<CoursePackageVersionSummary[]> {
    const records = await this.store.list();
    return records
      .filter((record) => record.status === 'PUBLISHED')
      .map((record) => this.toSummary(record));
  }

  async getPublished(id: string): Promise<CoursePackageVersionRecord> {
    const record = await this.get(id);
    if (record.status !== 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '课程包版本不存在',
      );
    }
    return record;
  }

  async get(id: string): Promise<CoursePackageVersionRecord> {
    const record = await this.store.findById(id);
    if (!record) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '课程包版本不存在',
      );
    }
    return record;
  }

  async createDraft(
    input: CreateCoursePackageVersionInput,
  ): Promise<CoursePackageVersionSummary> {
    await this.assertUniqueVersion(input.packageKey, input.version);
    const now = new Date();
    const record = this.buildRecord(input, {
      status: 'DRAFT',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.save(record);
    return this.toSummary(record);
  }

  async publish(id: string): Promise<CoursePackageVersionSummary> {
    const record = await this.get(id);
    if (record.status === 'PUBLISHED') {
      return this.toSummary(record);
    }
    record.status = 'PUBLISHED';
    record.publishedAt = new Date();
    record.updatedAt = record.publishedAt;
    await this.store.save(record);
    return this.toSummary(record);
  }

  async revise(
    id: string,
    input: ReviseCoursePackageVersionInput,
  ): Promise<CoursePackageVersionSummary> {
    const source = await this.get(id);
    if (source.status !== 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '仅已发布版本可创建修订',
      );
    }
    await this.assertUniqueVersion(source.packageKey, input.newVersion);
    const now = new Date();
    const draftInput: CreateCoursePackageVersionInput = {
      packageKey: source.packageKey,
      version: input.newVersion,
      title: input.title ?? source.title,
      mainLessons: source.mainLessons.map((lesson) => ({
        sequence: lesson.sequence,
        track: lesson.track,
        title: lesson.title,
        theme: lesson.theme,
        coreDeliverable: lesson.coreDeliverable,
        learningGoals: lesson.learningGoals,
        assignment: lesson.assignment,
      })),
      onlineQaSessions: source.onlineQaSessions.map((session) => ({
        sequence: session.sequence,
        afterLessonSequence: session.afterLessonSequence,
        title: session.title,
        topic: session.topic,
      })),
      rubrics: source.rubrics.map((rubric) => ({
        name: rubric.name,
        mainLessonSequence: rubric.mainLessonSequence,
        dimensions: rubric.dimensions,
      })),
    };
    const record = this.buildRecord(draftInput, {
      status: 'DRAFT',
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await this.store.save(record);
    return this.toSummary(record);
  }

  async assertMutable(id: string): Promise<void> {
    const record = await this.get(id);
    if (record.status === 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '已发布课程包版本不可原地修改，请创建新版本',
      );
    }
  }

  private async assertUniqueVersion(
    packageKey: string,
    version: string,
  ): Promise<void> {
    const existing = await this.store.findByPackageKeyAndVersion(
      packageKey,
      version,
    );
    if (existing) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '课程包版本号已存在',
      );
    }
  }

  private buildRecord(
    input: CreateCoursePackageVersionInput,
    meta: {
      status: CoursePackageVersionStatus;
      publishedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
  ): CoursePackageVersionRecord {
    const mainLessons: StoredMainLesson[] = input.mainLessons.map((lesson) => ({
      ...lesson,
      id: randomUUID(),
      assignmentId: randomUUID(),
    }));
    const lessonIdBySequence = new Map(
      mainLessons.map((lesson) => [lesson.sequence, lesson.id]),
    );
    return {
      id: randomUUID(),
      packageKey: input.packageKey,
      version: input.version,
      title: input.title,
      status: meta.status,
      publishedAt: meta.publishedAt,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      mainLessons,
      onlineQaSessions: input.onlineQaSessions.map((session) => ({
        ...session,
        id: randomUUID(),
      })),
      rubrics: input.rubrics.map((rubric) => ({
        ...rubric,
        id: randomUUID(),
        mainLessonId: rubric.mainLessonSequence
          ? lessonIdBySequence.get(rubric.mainLessonSequence)
          : undefined,
      })),
    };
  }

  private toSummary(
    record: CoursePackageVersionRecord,
  ): CoursePackageVersionSummary {
    return {
      id: record.id,
      packageKey: record.packageKey,
      version: record.version,
      title: record.title,
      status: record.status,
      publishedAt: record.publishedAt?.toISOString() ?? null,
      mainLessonCount: record.mainLessons.length,
      onlineQaSessionCount: record.onlineQaSessions.length,
    };
  }
}
