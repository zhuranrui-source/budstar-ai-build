/**
 * ADR-0009：校区内员工仅保留教师一类，班级管理、提交处理、点评、
 * 五维复核、报告发布和家长沟通全部归教师；预约线索跟进归平台管理员；
 * 合作方（B 端机构）仅可见已发布课程与活动内容。
 */
export type StaffRole = 'TEACHER';

export type CampusCapability =
  | 'CAMPUS_CONTEXT_READ'
  | 'SUBMISSION_REVIEW'
  | 'FEEDBACK_PUBLISH'
  | 'CLASS_MANAGE'
  | 'FAMILY_COMMUNICATE'
  | 'REPORT_PUBLISH';

export type PlatformCapability =
  | 'PLATFORM_CAMPUS_GOVERN'
  | 'PLATFORM_COURSE_VERSION_GOVERN'
  | 'PLATFORM_CRM_OPERATE';

export type AuthorizationActor =
  | {
      kind: 'staff';
      userAccountId: string;
      memberships: Array<{
        campusId: string;
        roles: StaffRole[];
      }>;
    }
  | {
      kind: 'platform-admin';
      userAccountId: string;
      capabilities: PlatformCapability[];
    }
  | {
      kind: 'partner';
      userAccountId: string;
    }
  | {
      kind: 'parent';
      userAccountId: string;
      parentProfileId: string;
      activeStudentBindings: string[];
    }
  | {
      kind: 'student';
      userAccountId: string;
      studentProfileId: string;
    };

const teacherCapabilities: readonly CampusCapability[] = [
  'CAMPUS_CONTEXT_READ',
  'SUBMISSION_REVIEW',
  'FEEDBACK_PUBLISH',
  'CLASS_MANAGE',
  'FAMILY_COMMUNICATE',
  'REPORT_PUBLISH',
];

export class CampusAuthorizationPolicy {
  canAccessCampus(
    actor: AuthorizationActor,
    campusId: string,
    capability: CampusCapability,
  ): boolean {
    if (actor.kind !== 'staff') {
      return false;
    }

    const membership = actor.memberships.find(
      (candidate) => candidate.campusId === campusId,
    );

    return membership?.roles.includes('TEACHER')
      ? teacherCapabilities.includes(capability)
      : false;
  }

  canGovernPlatform(
    actor: AuthorizationActor,
    capability: PlatformCapability,
  ): boolean {
    return (
      actor.kind === 'platform-admin' && actor.capabilities.includes(capability)
    );
  }

  /** ADR-0009：仅合作方身份可浏览已发布课程与活动内容。 */
  canViewPublishedContent(actor: AuthorizationActor): boolean {
    return actor.kind === 'partner';
  }

  canAccessStudent(actor: AuthorizationActor, studentProfileId: string) {
    if (actor.kind === 'parent') {
      return actor.activeStudentBindings.includes(studentProfileId);
    }

    return (
      actor.kind === 'student' && actor.studentProfileId === studentProfileId
    );
  }
}
