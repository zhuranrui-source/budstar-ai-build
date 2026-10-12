import { Injectable } from '@nestjs/common';
import type {
  GuardianBindingStatus,
  GuardianConsentType,
} from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  FamilyStore,
  GuardianBindingRecord,
  GuardianConsentEntity,
  ParentProfileRecord,
  StudentProfileRecord,
} from './family.service';

@Injectable()
export class PrismaFamilyStore implements FamilyStore {
  constructor(private readonly prisma: PrismaService) {}

  async listStudentsByCampus(
    campusId: string,
  ): Promise<StudentProfileRecord[]> {
    const rows = await this.prisma.client.studentProfile.findMany({
      where: { campusId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toStudent(row));
  }

  async findStudentById(id: string): Promise<StudentProfileRecord | null> {
    const row = await this.prisma.client.studentProfile.findUnique({
      where: { id },
    });
    return row ? this.toStudent(row) : null;
  }

  async findStudentByViewCodeHash(
    codeHash: string,
  ): Promise<StudentProfileRecord | null> {
    const row = await this.prisma.client.studentProfile.findFirst({
      where: { familyViewCodeHash: codeHash },
    });
    return row ? this.toStudent(row) : null;
  }

  async saveStudent(
    record: StudentProfileRecord,
  ): Promise<StudentProfileRecord> {
    const row = await this.prisma.client.studentProfile.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        displayName: record.displayName,
        familyViewCodeHash: record.familyViewCodeHash,
        familyViewCodeUpdatedAt: record.familyViewCodeUpdatedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        displayName: record.displayName,
        familyViewCodeHash: record.familyViewCodeHash,
        familyViewCodeUpdatedAt: record.familyViewCodeUpdatedAt,
        updatedAt: record.updatedAt,
      },
    });
    return this.toStudent(row);
  }

  async findParentById(id: string): Promise<ParentProfileRecord | null> {
    const row = await this.prisma.client.parentProfile.findUnique({
      where: { id },
    });
    return row ? this.toParent(row) : null;
  }

  async findParentByAccountId(
    userAccountId: string,
  ): Promise<ParentProfileRecord | null> {
    const row = await this.prisma.client.parentProfile.findFirst({
      where: { userAccountId },
    });
    return row ? this.toParent(row) : null;
  }

  async saveParent(record: ParentProfileRecord): Promise<ParentProfileRecord> {
    const row = await this.prisma.client.parentProfile.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        userAccountId: record.userAccountId,
        displayName: record.displayName,
        selectedStudentProfileId: record.selectedStudentProfileId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        campusId: record.campusId,
        userAccountId: record.userAccountId,
        displayName: record.displayName,
        selectedStudentProfileId: record.selectedStudentProfileId,
        updatedAt: record.updatedAt,
      },
    });
    return this.toParent(row);
  }

  async listBindingsByParent(
    parentProfileId: string,
  ): Promise<GuardianBindingRecord[]> {
    const rows = await this.prisma.client.guardianBinding.findMany({
      where: { parentProfileId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toBinding(row));
  }

  async listBindingsByCampus(
    campusId: string,
  ): Promise<GuardianBindingRecord[]> {
    const rows = await this.prisma.client.guardianBinding.findMany({
      where: { campusId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toBinding(row));
  }

  async listBindingsByStudent(
    studentProfileId: string,
  ): Promise<GuardianBindingRecord[]> {
    const rows = await this.prisma.client.guardianBinding.findMany({
      where: { studentProfileId },
    });
    return rows.map((row) => this.toBinding(row));
  }

  async findBinding(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<GuardianBindingRecord | null> {
    const row = await this.prisma.client.guardianBinding.findFirst({
      where: { parentProfileId, studentProfileId },
    });
    return row ? this.toBinding(row) : null;
  }

  async saveBinding(
    record: GuardianBindingRecord,
  ): Promise<GuardianBindingRecord> {
    const row = await this.prisma.client.guardianBinding.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        parentProfileId: record.parentProfileId,
        studentProfileId: record.studentProfileId,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      update: {
        status: record.status,
        updatedAt: record.updatedAt,
      },
    });
    return this.toBinding(row);
  }

  async listConsentsForStudent(
    studentProfileId: string,
  ): Promise<GuardianConsentEntity[]> {
    const rows = await this.prisma.client.guardianConsent.findMany({
      where: { studentProfileId },
      orderBy: { recordedAt: 'desc' },
    });
    return rows.map((row) => this.toConsent(row));
  }

  async saveConsent(
    record: GuardianConsentEntity,
  ): Promise<GuardianConsentEntity> {
    const row = await this.prisma.client.guardianConsent.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        parentProfileId: record.parentProfileId,
        studentProfileId: record.studentProfileId,
        type: record.type,
        policyVersion: record.policyVersion,
        granted: record.granted,
        recordedAt: record.recordedAt,
        revokedAt: record.revokedAt,
      },
      update: {
        granted: record.granted,
        revokedAt: record.revokedAt,
        policyVersion: record.policyVersion,
      },
    });
    return this.toConsent(row);
  }

  async countActiveBindings(studentProfileId: string): Promise<number> {
    return await this.prisma.client.guardianBinding.count({
      where: { studentProfileId, status: 'ACTIVE' },
    });
  }

  private toStudent(row: {
    id: string;
    campusId: string;
    displayName: string;
    familyViewCodeHash: string | null;
    familyViewCodeUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): StudentProfileRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      displayName: row.displayName,
      familyViewCodeHash: row.familyViewCodeHash,
      familyViewCodeUpdatedAt: row.familyViewCodeUpdatedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toParent(row: {
    id: string;
    campusId: string;
    userAccountId: string | null;
    displayName: string;
    selectedStudentProfileId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ParentProfileRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      userAccountId: row.userAccountId,
      displayName: row.displayName,
      selectedStudentProfileId: row.selectedStudentProfileId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toBinding(row: {
    id: string;
    campusId: string;
    parentProfileId: string;
    studentProfileId: string;
    status: GuardianBindingStatus;
    createdAt: Date;
    updatedAt: Date;
  }): GuardianBindingRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      parentProfileId: row.parentProfileId,
      studentProfileId: row.studentProfileId,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toConsent(row: {
    id: string;
    campusId: string;
    parentProfileId: string;
    studentProfileId: string;
    type: GuardianConsentType;
    policyVersion: string;
    granted: boolean;
    recordedAt: Date;
    revokedAt: Date | null;
  }): GuardianConsentEntity {
    return {
      id: row.id,
      campusId: row.campusId,
      parentProfileId: row.parentProfileId,
      studentProfileId: row.studentProfileId,
      type: row.type,
      policyVersion: row.policyVersion,
      granted: row.granted,
      recordedAt: row.recordedAt,
      revokedAt: row.revokedAt,
    };
  }
}
