import {
  CampusAuthorizationPolicy,
  type AuthorizationActor,
} from './campus-authorization.policy';

describe('CampusAuthorizationPolicy (ADR-0009 simplified roles)', () => {
  const policy = new CampusAuthorizationPolicy();

  const teacher = (campusId = 'campus-a'): AuthorizationActor => ({
    kind: 'staff',
    userAccountId: 'staff-1',
    memberships: [{ campusId, roles: ['TEACHER'] }],
  });

  it('lets a teacher run the full campus delivery chain', () => {
    const capabilities = [
      'CAMPUS_CONTEXT_READ',
      'SUBMISSION_REVIEW',
      'FEEDBACK_PUBLISH',
      'CLASS_MANAGE',
      'FAMILY_COMMUNICATE',
      'REPORT_PUBLISH',
    ] as const;
    for (const capability of capabilities) {
      expect(policy.canAccessCampus(teacher(), 'campus-a', capability)).toBe(
        true,
      );
    }
  });

  it('denies a teacher campus delivery outside the authorized campus', () => {
    expect(policy.canAccessCampus(teacher(), 'campus-b', 'CLASS_MANAGE')).toBe(
      false,
    );
  });

  it('denies a teacher the legacy lead-management capability (platform CRM only)', () => {
    // ADR-0009 后线索能力已迁至平台（PLATFORM_CRM_OPERATE），
    // 旧的校区能力字符串必须一律拒绝。
    const legacy = 'APPOINTMENT_LEAD_MANAGE' as Parameters<
      CampusAuthorizationPolicy['canAccessCampus']
    >[2];
    expect(policy.canAccessCampus(teacher(), 'campus-a', legacy)).toBe(false);
  });

  it('keeps platform administrators out of campus business data', () => {
    const actor: AuthorizationActor = {
      kind: 'platform-admin',
      userAccountId: 'platform-1',
      capabilities: ['PLATFORM_CAMPUS_GOVERN', 'PLATFORM_CRM_OPERATE'],
    };

    expect(policy.canAccessCampus(actor, 'campus-a', 'CLASS_MANAGE')).toBe(
      false,
    );
    expect(policy.canGovernPlatform(actor, 'PLATFORM_CRM_OPERATE')).toBe(true);
  });

  it('lets a partner view published content but no campus or student data', () => {
    const actor: AuthorizationActor = {
      kind: 'partner',
      userAccountId: 'partner-1',
    };

    expect(policy.canViewPublishedContent(actor)).toBe(true);
    expect(policy.canAccessCampus(actor, 'campus-a', 'CLASS_MANAGE')).toBe(
      false,
    );
    expect(policy.canAccessStudent(actor, 'student-1')).toBe(false);
    expect(
      policy.canGovernPlatform(actor, 'PLATFORM_COURSE_VERSION_GOVERN'),
    ).toBe(false);
  });

  it('does not let staff or platform admins pose as partners for content viewing', () => {
    expect(
      policy.canViewPublishedContent({
        kind: 'staff',
        userAccountId: 'staff-1',
        memberships: [],
      }),
    ).toBe(false);
  });
});
