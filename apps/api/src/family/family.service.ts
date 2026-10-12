import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  canTransitionGuardianBindingStatus,
  CURRENT_GUARDIAN_CONSENT_POLICY_VERSION,
  type BindFamilyViewCodeInput,
  type CreateStudentProfileInput,
  type FamilyBindingSummary,
  type FamilyViewCodeIssued,
  type GuardianBindingStatus,
  type GuardianConsentRecord,
  type GuardianConsentType,
  type ParentStudentSwitcher,
  type RecordGuardianConsentInput,
  type SelectActiveStudentInput,
  type StudentProfileSummary,
  type WorkDisplayEligibility,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';

/** ADR-0008：家庭绑定/入班时一次性展示总开关的策略版本。 */
export const FAMILY_DISPLAY_SWITCH_POLICY_VERSION = '2026-08-01';

export type StudentProfileRecord = {
  id: string;
  campusId: string;
  displayName: string;
  familyViewCodeHash: string | null;
  familyViewCodeUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ParentProfileRecord = {
  id: string;
  campusId: string;
  userAccountId: string | null;
  displayName: string;
  selectedStudentProfileId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GuardianBindingRecord = {
  id: string;
  campusId: string;
  parentProfileId: string;
  studentProfileId: string;
  status: GuardianBindingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type GuardianConsentEntity = {
  id: string;
  campusId: string;
  parentProfileId: string;
  studentProfileId: string;
  type: GuardianConsentType;
  policyVersion: string;
  granted: boolean;
  recordedAt: Date;
  revokedAt: Date | null;
};

export interface FamilyStore {
  listStudentsByCampus(campusId: string): Promise<StudentProfileRecord[]>;
  findStudentById(id: string): Promise<StudentProfileRecord | null>;
  findStudentByViewCodeHash(
    codeHash: string,
  ): Promise<StudentProfileRecord | null>;
  saveStudent(record: StudentProfileRecord): Promise<StudentProfileRecord>;
  findParentById(id: string): Promise<ParentProfileRecord | null>;
  findParentByAccountId(
    userAccountId: string,
  ): Promise<ParentProfileRecord | null>;
  saveParent(record: ParentProfileRecord): Promise<ParentProfileRecord>;
  listBindingsByParent(
    parentProfileId: string,
  ): Promise<GuardianBindingRecord[]>;
  listBindingsByCampus(campusId: string): Promise<GuardianBindingRecord[]>;
  listBindingsByStudent(
    studentProfileId: string,
  ): Promise<GuardianBindingRecord[]>;
  findBinding(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<GuardianBindingRecord | null>;
  saveBinding(record: GuardianBindingRecord): Promise<GuardianBindingRecord>;
  listConsentsForStudent(
    studentProfileId: string,
  ): Promise<GuardianConsentEntity[]>;
  saveConsent(record: GuardianConsentEntity): Promise<GuardianConsentEntity>;
  countActiveBindings(studentProfileId: string): Promise<number>;
}

export class InMemoryFamilyStore implements FamilyStore {
  private readonly students = new Map<string, StudentProfileRecord>();
  private readonly parents = new Map<string, ParentProfileRecord>();
  private readonly bindings = new Map<string, GuardianBindingRecord>();
  private readonly consents = new Map<string, GuardianConsentEntity>();

  listStudentsByCampus(campusId: string): Promise<StudentProfileRecord[]> {
    return Promise.resolve(
      [...this.students.values()].filter((item) => item.campusId === campusId),
    );
  }

  findStudentById(id: string): Promise<StudentProfileRecord | null> {
    return Promise.resolve(this.students.get(id) ?? null);
  }

  findStudentByViewCodeHash(
    codeHash: string,
  ): Promise<StudentProfileRecord | null> {
    return Promise.resolve(
      [...this.students.values()].find(
        (item) => item.familyViewCodeHash === codeHash,
      ) ?? null,
    );
  }

  saveStudent(record: StudentProfileRecord): Promise<StudentProfileRecord> {
    this.students.set(record.id, record);
    return Promise.resolve(record);
  }

  findParentById(id: string): Promise<ParentProfileRecord | null> {
    return Promise.resolve(this.parents.get(id) ?? null);
  }

  findParentByAccountId(
    userAccountId: string,
  ): Promise<ParentProfileRecord | null> {
    return Promise.resolve(
      [...this.parents.values()].find(
        (item) => item.userAccountId === userAccountId,
      ) ?? null,
    );
  }

  saveParent(record: ParentProfileRecord): Promise<ParentProfileRecord> {
    this.parents.set(record.id, record);
    return Promise.resolve(record);
  }

  listBindingsByParent(
    parentProfileId: string,
  ): Promise<GuardianBindingRecord[]> {
    return Promise.resolve(
      [...this.bindings.values()].filter(
        (item) => item.parentProfileId === parentProfileId,
      ),
    );
  }

  listBindingsByCampus(campusId: string): Promise<GuardianBindingRecord[]> {
    return Promise.resolve(
      [...this.bindings.values()].filter((item) => item.campusId === campusId),
    );
  }

  listBindingsByStudent(
    studentProfileId: string,
  ): Promise<GuardianBindingRecord[]> {
    return Promise.resolve(
      [...this.bindings.values()].filter(
        (item) => item.studentProfileId === studentProfileId,
      ),
    );
  }

  findBinding(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<GuardianBindingRecord | null> {
    return Promise.resolve(
      [...this.bindings.values()].find(
        (item) =>
          item.parentProfileId === parentProfileId &&
          item.studentProfileId === studentProfileId,
      ) ?? null,
    );
  }

  saveBinding(record: GuardianBindingRecord): Promise<GuardianBindingRecord> {
    this.bindings.set(record.id, record);
    return Promise.resolve(record);
  }

  listConsentsForStudent(
    studentProfileId: string,
  ): Promise<GuardianConsentEntity[]> {
    return Promise.resolve(
      [...this.consents.values()].filter(
        (item) => item.studentProfileId === studentProfileId,
      ),
    );
  }

  saveConsent(record: GuardianConsentEntity): Promise<GuardianConsentEntity> {
    this.consents.set(record.id, record);
    return Promise.resolve(record);
  }

  countActiveBindings(studentProfileId: string): Promise<number> {
    return Promise.resolve(
      [...this.bindings.values()].filter(
        (item) =>
          item.studentProfileId === studentProfileId &&
          item.status === 'ACTIVE',
      ).length,
    );
  }
}

export type ParentBindingSync = {
  syncActiveStudentBindings(
    userAccountId: string,
    studentProfileIds: string[],
  ): void;
};

@Injectable()
export class FamilyService {
  private readonly codeSecret: string;

  constructor(
    private readonly store: FamilyStore,
    private readonly parentBindingSync?: ParentBindingSync,
  ) {
    const configured = process.env.AUTH_TOKEN_SECRET;
    this.codeSecret =
      configured ?? 'local-test-secret-do-not-use-in-production';
  }

  async listStudents(campusId: string): Promise<StudentProfileSummary[]> {
    const students = await this.store.listStudentsByCampus(campusId);
    return Promise.all(
      students.map(async (student) => ({
        id: student.id,
        campusId: student.campusId,
        displayName: student.displayName,
        hasFamilyViewCode: Boolean(student.familyViewCodeHash),
        familyViewCodeUpdatedAt:
          student.familyViewCodeUpdatedAt?.toISOString() ?? null,
        activeBindingCount: await this.store.countActiveBindings(student.id),
      })),
    );
  }

  async createStudent(
    campusId: string,
    input: CreateStudentProfileInput,
  ): Promise<FamilyViewCodeIssued & { displayName: string }> {
    const now = new Date();
    const familyViewCode = this.allocateViewCode();
    const student: StudentProfileRecord = {
      id: randomUUID(),
      campusId,
      displayName: input.displayName,
      familyViewCodeHash: this.hashViewCode(familyViewCode),
      familyViewCodeUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveStudent(student);
    return {
      studentProfileId: student.id,
      displayName: student.displayName,
      familyViewCode,
      updatedAt: now.toISOString(),
    };
  }

  async resetFamilyViewCode(
    campusId: string,
    studentProfileId: string,
  ): Promise<FamilyViewCodeIssued> {
    const student = await this.requireCampusStudent(campusId, studentProfileId);
    const familyViewCode = this.allocateViewCode();
    const now = new Date();
    student.familyViewCodeHash = this.hashViewCode(familyViewCode);
    student.familyViewCodeUpdatedAt = now;
    student.updatedAt = now;
    await this.store.saveStudent(student);
    return {
      studentProfileId: student.id,
      familyViewCode,
      updatedAt: now.toISOString(),
    };
  }

  async listCampusBindings(campusId: string): Promise<FamilyBindingSummary[]> {
    const bindings = await this.store.listBindingsByCampus(campusId);
    return this.toBindingSummaries(bindings);
  }

  async revokeBindingAsStaff(
    campusId: string,
    bindingId: string,
  ): Promise<FamilyBindingSummary> {
    const bindings = await this.store.listBindingsByCampus(campusId);
    const binding = bindings.find((item) => item.id === bindingId);
    if (!binding) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '绑定不存在');
    }
    await this.transitionBinding(binding, 'REVOKED');
    await this.syncParentBindings(binding.parentProfileId);
    const [summary] = await this.toBindingSummaries([binding]);
    return summary;
  }

  async ensureParentProfile(input: {
    userAccountId: string;
    parentProfileId: string;
    displayName: string;
    campusId: string;
  }): Promise<ParentProfileRecord> {
    const existing = await this.store.findParentByAccountId(
      input.userAccountId,
    );
    if (existing) {
      if (existing.campusId !== input.campusId) {
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'FORBIDDEN',
          '家长与学生校区不匹配',
        );
      }
      return existing;
    }
    const byId = await this.store.findParentById(input.parentProfileId);
    if (byId) {
      if (byId.campusId !== input.campusId) {
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          'FORBIDDEN',
          '家长与学生校区不匹配',
        );
      }
      byId.userAccountId = input.userAccountId;
      byId.updatedAt = new Date();
      return this.store.saveParent(byId);
    }
    const now = new Date();
    return this.store.saveParent({
      id: input.parentProfileId,
      campusId: input.campusId,
      userAccountId: input.userAccountId,
      displayName: input.displayName,
      selectedStudentProfileId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  async bindWithViewCode(
    parent: {
      userAccountId: string;
      parentProfileId: string;
      displayName: string;
    },
    input: BindFamilyViewCodeInput,
  ): Promise<FamilyBindingSummary> {
    const student = await this.store.findStudentByViewCodeHash(
      this.hashViewCode(input.familyViewCode),
    );
    if (!student) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '家庭查看码无效',
      );
    }

    const parentProfile = await this.ensureParentProfile({
      ...parent,
      campusId: student.campusId,
    });

    const existing = await this.store.findBinding(parentProfile.id, student.id);
    const now = new Date();
    let binding: GuardianBindingRecord;
    if (existing) {
      if (existing.status === 'ACTIVE') {
        binding = existing;
      } else {
        await this.transitionBinding(existing, 'ACTIVE');
        binding = existing;
      }
    } else {
      binding = {
        id: randomUUID(),
        campusId: student.campusId,
        parentProfileId: parentProfile.id,
        studentProfileId: student.id,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };
      await this.store.saveBinding(binding);
    }

    if (!parentProfile.selectedStudentProfileId) {
      parentProfile.selectedStudentProfileId = student.id;
      parentProfile.updatedAt = now;
      await this.store.saveParent(parentProfile);
    }
    await this.syncParentBindings(parentProfile.id);
    if (input.displaySwitchGranted !== undefined) {
      await this.recordConsent(parent, {
        studentProfileId: student.id,
        type: 'DISPLAY_SWITCH',
        granted: input.displaySwitchGranted,
        policyVersion: FAMILY_DISPLAY_SWITCH_POLICY_VERSION,
      });
    }
    const [summary] = await this.toBindingSummaries([binding]);
    return summary;
  }

  async listParentBindings(
    parentProfileId: string,
  ): Promise<FamilyBindingSummary[]> {
    const bindings = await this.store.listBindingsByParent(parentProfileId);
    return this.toBindingSummaries(bindings);
  }

  async revokeOwnBinding(
    parentProfileId: string,
    bindingId: string,
  ): Promise<FamilyBindingSummary> {
    const bindings = await this.store.listBindingsByParent(parentProfileId);
    const binding = bindings.find((item) => item.id === bindingId);
    if (!binding) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '绑定不存在');
    }
    await this.transitionBinding(binding, 'REVOKED');
    const parent = await this.store.findParentById(parentProfileId);
    if (parent?.selectedStudentProfileId === binding.studentProfileId) {
      const remaining = bindings.filter(
        (item) => item.id !== binding.id && item.status === 'ACTIVE',
      );
      parent.selectedStudentProfileId = remaining[0]?.studentProfileId ?? null;
      parent.updatedAt = new Date();
      await this.store.saveParent(parent);
    }
    await this.syncParentBindings(parentProfileId);
    const [summary] = await this.toBindingSummaries([binding]);
    return summary;
  }

  async getStudentSwitcher(
    parentProfileId: string,
  ): Promise<ParentStudentSwitcher> {
    const parent = await this.store.findParentById(parentProfileId);
    const bindings = (
      await this.store.listBindingsByParent(parentProfileId)
    ).filter((item) => item.status === 'ACTIVE');
    const students = await Promise.all(
      bindings.map(async (binding) => {
        const student = await this.store.findStudentById(
          binding.studentProfileId,
        );
        return {
          studentProfileId: binding.studentProfileId,
          displayName: student?.displayName ?? '学生',
          campusId: binding.campusId,
          bindingId: binding.id,
        };
      }),
    );
    const selected = parent?.selectedStudentProfileId;
    const selectedStillActive = students.some(
      (item) => item.studentProfileId === selected,
    );
    return {
      students,
      selectedStudentProfileId: selectedStillActive ? (selected ?? null) : null,
    };
  }

  async selectActiveStudent(
    parentProfileId: string,
    input: SelectActiveStudentInput,
  ): Promise<ParentStudentSwitcher> {
    const switcher = await this.getStudentSwitcher(parentProfileId);
    if (
      !switcher.students.some(
        (item) => item.studentProfileId === input.studentProfileId,
      )
    ) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '只能切换到有效绑定的学生',
      );
    }
    const parent = await this.store.findParentById(parentProfileId);
    if (!parent) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        'NOT_FOUND',
        '家长档案不存在',
      );
    }
    parent.selectedStudentProfileId = input.studentProfileId;
    parent.updatedAt = new Date();
    await this.store.saveParent(parent);
    return this.getStudentSwitcher(parentProfileId);
  }

  async recordConsent(
    parent: {
      parentProfileId: string;
      userAccountId: string;
      displayName: string;
    },
    input: RecordGuardianConsentInput,
  ): Promise<GuardianConsentRecord> {
    await this.assertActiveBinding(
      parent.parentProfileId,
      input.studentProfileId,
    );
    const student = await this.store.findStudentById(input.studentProfileId);
    if (!student) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '学生不存在');
    }
    const existing = (
      await this.store.listConsentsForStudent(input.studentProfileId)
    ).filter(
      (item) =>
        item.parentProfileId === parent.parentProfileId &&
        item.type === input.type &&
        item.policyVersion === input.policyVersion &&
        item.revokedAt === null,
    );
    for (const prior of existing) {
      prior.revokedAt = new Date();
      await this.store.saveConsent(prior);
    }
    const now = new Date();
    const record: GuardianConsentEntity = {
      id: randomUUID(),
      campusId: student.campusId,
      parentProfileId: parent.parentProfileId,
      studentProfileId: input.studentProfileId,
      type: input.type,
      policyVersion: input.policyVersion,
      granted: input.granted,
      recordedAt: now,
      revokedAt: input.granted ? null : now,
    };
    await this.store.saveConsent(record);
    return this.toConsentRecord(record);
  }

  async listConsents(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<GuardianConsentRecord[]> {
    await this.assertActiveBinding(parentProfileId, studentProfileId);
    const consents = await this.store.listConsentsForStudent(studentProfileId);
    return consents
      .filter((item) => item.parentProfileId === parentProfileId)
      .map((item) => this.toConsentRecord(item));
  }

  async getWorkDisplayEligibility(
    studentProfileId: string,
    options?: { parentProfileId?: string },
  ): Promise<WorkDisplayEligibility> {
    if (options?.parentProfileId) {
      const active = await this.hasActiveBinding(
        options.parentProfileId,
        studentProfileId,
      );
      if (!active) {
        return {
          studentProfileId,
          canDisplayPublicly: false,
          reason: 'BINDING_INACTIVE',
          policyVersion: null,
        };
      }
    }

    const allConsents =
      await this.store.listConsentsForStudent(studentProfileId);
    const switches = allConsents
      .filter((item) => item.type === 'DISPLAY_SWITCH')
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
    const latestSwitch = switches[0];
    if (latestSwitch) {
      const active = !latestSwitch.revokedAt && latestSwitch.granted;
      return {
        studentProfileId,
        canDisplayPublicly: active,
        reason: active ? 'DISPLAY_SWITCH_GRANTED' : 'DISPLAY_SWITCH_REVOKED',
        policyVersion: latestSwitch.policyVersion,
      };
    }

    const consents = allConsents
      .filter((item) => item.type === 'WORK_DISPLAY')
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
    const latest = consents[0];
    if (!latest || latest.revokedAt) {
      return {
        studentProfileId,
        canDisplayPublicly: false,
        reason: latest ? 'WORK_DISPLAY_REVOKED' : 'WORK_DISPLAY_MISSING',
        policyVersion: latest?.policyVersion ?? null,
      };
    }
    if (!latest.granted) {
      return {
        studentProfileId,
        canDisplayPublicly: false,
        reason: 'WORK_DISPLAY_REVOKED',
        policyVersion: latest.policyVersion,
      };
    }
    return {
      studentProfileId,
      canDisplayPublicly: true,
      reason: 'WORK_DISPLAY_GRANTED',
      policyVersion: latest.policyVersion,
    };
  }

  /** Rule API used by community/submission modules. */
  async assertWorkDisplayAllowed(studentProfileId: string): Promise<void> {
    const eligibility = await this.getWorkDisplayEligibility(studentProfileId);
    if (!eligibility.canDisplayPublicly) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '缺少作品对外展示授权，不可公开展示',
      );
    }
  }

  /**
   * ADR-0007：家庭视图内家长以受绑定约束的方式访问学生的课程与作品数据。
   * 学生是档案而非登录身份，所有学习数据代理都必须经过这里。
   */
  async assertParentStudentAccess(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<void> {
    const active = await this.listActiveStudentIdsForParent(parentProfileId);
    if (!active.includes(studentProfileId)) {
      throw new ApiException(403, 'FORBIDDEN', '只能访问有效绑定的学生');
    }
  }

  async listActiveStudentIdsForParent(
    parentProfileId: string,
  ): Promise<string[]> {
    return (await this.store.listBindingsByParent(parentProfileId))
      .filter((item) => item.status === 'ACTIVE')
      .map((item) => item.studentProfileId);
  }

  private async assertActiveBinding(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<void> {
    if (!(await this.hasActiveBinding(parentProfileId, studentProfileId))) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '只能访问有效绑定的学生',
      );
    }
  }

  private async hasActiveBinding(
    parentProfileId: string,
    studentProfileId: string,
  ): Promise<boolean> {
    const binding = await this.store.findBinding(
      parentProfileId,
      studentProfileId,
    );
    return binding?.status === 'ACTIVE';
  }

  private async transitionBinding(
    binding: GuardianBindingRecord,
    to: GuardianBindingStatus,
  ): Promise<void> {
    if (binding.status === to) return;
    if (!canTransitionGuardianBindingStatus(binding.status, to)) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'CONFLICT',
        '家庭绑定状态流转不合法',
      );
    }
    binding.status = to;
    binding.updatedAt = new Date();
    await this.store.saveBinding(binding);
  }

  private async syncParentBindings(parentProfileId: string): Promise<void> {
    const parent = await this.store.findParentById(parentProfileId);
    if (!parent?.userAccountId || !this.parentBindingSync) return;
    const activeIds = await this.listActiveStudentIdsForParent(parentProfileId);
    this.parentBindingSync.syncActiveStudentBindings(
      parent.userAccountId,
      activeIds,
    );
  }

  private async requireCampusStudent(
    campusId: string,
    studentProfileId: string,
  ): Promise<StudentProfileRecord> {
    const student = await this.store.findStudentById(studentProfileId);
    if (!student || student.campusId !== campusId) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '学生不存在');
    }
    return student;
  }

  private async toBindingSummaries(
    bindings: GuardianBindingRecord[],
  ): Promise<FamilyBindingSummary[]> {
    return Promise.all(
      bindings.map(async (binding) => {
        const student = await this.store.findStudentById(
          binding.studentProfileId,
        );
        return {
          id: binding.id,
          campusId: binding.campusId,
          parentProfileId: binding.parentProfileId,
          studentProfileId: binding.studentProfileId,
          studentDisplayName: student?.displayName ?? '学生',
          status: binding.status,
          createdAt: binding.createdAt.toISOString(),
          updatedAt: binding.updatedAt.toISOString(),
        };
      }),
    );
  }

  private toConsentRecord(
    record: GuardianConsentEntity,
  ): GuardianConsentRecord {
    return {
      id: record.id,
      campusId: record.campusId,
      parentProfileId: record.parentProfileId,
      studentProfileId: record.studentProfileId,
      type: record.type,
      policyVersion: record.policyVersion,
      granted: record.granted,
      recordedAt: record.recordedAt.toISOString(),
      revokedAt: record.revokedAt?.toISOString() ?? null,
    };
  }

  private allocateViewCode(): string {
    return randomBytes(4).toString('hex').toUpperCase();
  }

  private hashViewCode(code: string): string {
    return createHmac('sha256', this.codeSecret)
      .update(code.toUpperCase())
      .digest('hex');
  }
}

export { CURRENT_GUARDIAN_CONSENT_POLICY_VERSION };
