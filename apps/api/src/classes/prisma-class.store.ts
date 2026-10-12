import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
  ClassRecord,
  ClassStore,
  ClassStudentRecord,
  PublishedCourseVersionRef,
} from './classes.service';

@Injectable()
export class PrismaClassStore implements ClassStore {
  constructor(private readonly prisma: PrismaService) {}

  async findPublishedCourseVersion(
    id: string,
  ): Promise<PublishedCourseVersionRef | null> {
    const version = await this.prisma.client.coursePackageVersion.findUnique({
      where: { id },
      select: { id: true, title: true, version: true, status: true },
    });
    return version;
  }

  async listByCampus(campusId: string): Promise<ClassRecord[]> {
    const rows = await this.prisma.client.teachingClass.findMany({
      where: { campusId },
      include: { coursePackageVersion: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.mapClass(row));
  }

  async findById(id: string): Promise<ClassRecord | null> {
    const row = await this.prisma.client.teachingClass.findUnique({
      where: { id },
      include: { coursePackageVersion: true },
    });
    return row ? this.mapClass(row) : null;
  }

  async findByClassCode(classCode: string): Promise<ClassRecord | null> {
    const row = await this.prisma.client.teachingClass.findUnique({
      where: { classCode },
      include: { coursePackageVersion: true },
    });
    return row ? this.mapClass(row) : null;
  }

  async save(record: ClassRecord): Promise<ClassRecord> {
    await this.prisma.client.teachingClass.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        coursePackageVersionId: record.coursePackageVersionId,
        name: record.name,
        classCode: record.classCode,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        name: record.name,
        status: record.status,
        updatedAt: record.updatedAt,
      },
    });
    return (await this.findById(record.id))!;
  }

  async listStudents(classId: string): Promise<ClassStudentRecord[]> {
    const rows = await this.prisma.client.classStudent.findMany({
      where: { classId },
      include: { studentProfile: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      displayName: row.studentProfile.displayName,
      joinedAt: row.joinedAt,
    }));
  }

  async countStudents(classId: string): Promise<number> {
    return this.prisma.client.classStudent.count({ where: { classId } });
  }

  private mapClass(row: {
    id: string;
    campusId: string;
    coursePackageVersionId: string;
    name: string;
    classCode: string;
    status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
    createdAt: Date;
    updatedAt: Date;
    coursePackageVersion: { title: string; version: string };
  }): ClassRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      coursePackageVersionId: row.coursePackageVersionId,
      coursePackageTitle: row.coursePackageVersion.title,
      coursePackageVersion: row.coursePackageVersion.version,
      name: row.name,
      classCode: row.classCode,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
