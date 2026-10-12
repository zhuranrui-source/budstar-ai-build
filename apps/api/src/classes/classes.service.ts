import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canTransitionClassStatus,
  type ClassStatus,
  type ClassStudent,
  type ClassSummary,
  type CreateClassInput,
  type UpdateClassInput,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

export type ClassRecord = {
  id: string;
  campusId: string;
  coursePackageVersionId: string;
  coursePackageTitle: string;
  coursePackageVersion: string;
  name: string;
  classCode: string;
  status: ClassStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ClassStudentRecord = {
  id: string;
  campusId: string;
  classId: string;
  studentProfileId: string;
  displayName: string;
  joinedAt: Date;
};

export type PublishedCourseVersionRef = {
  id: string;
  title: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED';
};

export interface ClassStore {
  findPublishedCourseVersion(
    id: string,
  ): Promise<PublishedCourseVersionRef | null>;
  listByCampus(campusId: string): Promise<ClassRecord[]>;
  findById(id: string): Promise<ClassRecord | null>;
  findByClassCode(classCode: string): Promise<ClassRecord | null>;
  save(record: ClassRecord): Promise<ClassRecord>;
  listStudents(classId: string): Promise<ClassStudentRecord[]>;
  countStudents(classId: string): Promise<number>;
}

export class InMemoryClassStore implements ClassStore {
  private readonly classes = new Map<string, ClassRecord>();
  private readonly students = new Map<string, ClassStudentRecord[]>();
  private readonly versions = new Map<string, PublishedCourseVersionRef>();

  seedPublishedVersion(version: PublishedCourseVersionRef): void {
    this.versions.set(version.id, version);
  }

  seedStudent(student: ClassStudentRecord): void {
    const existing = this.students.get(student.classId) ?? [];
    existing.push(student);
    this.students.set(student.classId, existing);
  }

  findPublishedCourseVersion(
    id: string,
  ): Promise<PublishedCourseVersionRef | null> {
    return Promise.resolve(this.versions.get(id) ?? null);
  }

  listByCampus(campusId: string): Promise<ClassRecord[]> {
    return Promise.resolve(
      [...this.classes.values()].filter((item) => item.campusId === campusId),
    );
  }

  findById(id: string): Promise<ClassRecord | null> {
    return Promise.resolve(this.classes.get(id) ?? null);
  }

  findByClassCode(classCode: string): Promise<ClassRecord | null> {
    return Promise.resolve(
      [...this.classes.values()].find((item) => item.classCode === classCode) ??
        null,
    );
  }

  save(record: ClassRecord): Promise<ClassRecord> {
    this.classes.set(record.id, record);
    return Promise.resolve(record);
  }

  listStudents(classId: string): Promise<ClassStudentRecord[]> {
    return Promise.resolve(this.students.get(classId) ?? []);
  }

  countStudents(classId: string): Promise<number> {
    return Promise.resolve((this.students.get(classId) ?? []).length);
  }
}

@Injectable()
export class ClassesService {
  constructor(private readonly store: ClassStore) {}

  async list(campusId: string): Promise<ClassSummary[]> {
    const records = await this.store.listByCampus(campusId);
    return Promise.all(records.map((record) => this.toSummary(record)));
  }

  async create(
    campusId: string,
    input: CreateClassInput,
  ): Promise<ClassSummary> {
    const version = await this.store.findPublishedCourseVersion(
      input.coursePackageVersionId,
    );
    if (!version || version.status !== 'PUBLISHED') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '班级只能绑定已发布的课程包版本',
      );
    }

    const now = new Date();
    const record: ClassRecord = {
      id: randomUUID(),
      campusId,
      coursePackageVersionId: version.id,
      coursePackageTitle: version.title,
      coursePackageVersion: version.version,
      name: input.name,
      classCode: await this.allocateClassCode(),
      status: 'DRAFT',
      createdAt: now,
      updatedAt: now,
    };
    await this.store.save(record);
    return this.toSummary(record);
  }

  async update(
    campusId: string,
    classId: string,
    input: UpdateClassInput,
  ): Promise<ClassSummary> {
    const record = await this.requireCampusClass(campusId, classId);
    if (input.name !== undefined) {
      record.name = input.name;
    }
    if (input.status !== undefined && input.status !== record.status) {
      if (!canTransitionClassStatus(record.status, input.status)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'CONFLICT',
          '班级状态流转不合法',
        );
      }
      record.status = input.status;
    }
    record.updatedAt = new Date();
    await this.store.save(record);
    return this.toSummary(record);
  }

  async listStudents(
    campusId: string,
    classId: string,
  ): Promise<ClassStudent[]> {
    await this.requireCampusClass(campusId, classId);
    const students = await this.store.listStudents(classId);
    return students.map((student) => ({
      studentProfileId: student.studentProfileId,
      displayName: student.displayName,
      joinedAt: student.joinedAt.toISOString(),
    }));
  }

  private async requireCampusClass(
    campusId: string,
    classId: string,
  ): Promise<ClassRecord> {
    const record = await this.store.findById(classId);
    if (!record || record.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '班级不存在');
    }
    return record;
  }

  private async allocateClassCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const classCode = `BS${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
      if (!(await this.store.findByClassCode(classCode))) {
        return classCode;
      }
    }
    throw new ApiException(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'INTERNAL_ERROR',
      '班级码生成失败',
    );
  }

  private async toSummary(record: ClassRecord): Promise<ClassSummary> {
    return {
      id: record.id,
      campusId: record.campusId,
      name: record.name,
      classCode: record.classCode,
      status: record.status,
      coursePackageVersionId: record.coursePackageVersionId,
      coursePackageTitle: record.coursePackageTitle,
      coursePackageVersion: record.coursePackageVersion,
      studentCount: await this.store.countStudents(record.id),
      createdAt: record.createdAt.toISOString(),
    };
  }
}
