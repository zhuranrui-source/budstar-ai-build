import { describe, expect, it } from 'vitest';
import {
  bindFamilyViewCodeSchema,
  canTransitionGuardianBindingStatus,
  CURRENT_GUARDIAN_CONSENT_POLICY_VERSION,
  recordGuardianConsentSchema,
  workDisplayEligibilitySchema,
} from './family';

describe('family contract', () => {
  it('only allows PENDING→ACTIVE→REVOKED transitions', () => {
    expect(canTransitionGuardianBindingStatus('PENDING', 'ACTIVE')).toBe(true);
    expect(canTransitionGuardianBindingStatus('ACTIVE', 'REVOKED')).toBe(true);
    expect(canTransitionGuardianBindingStatus('PENDING', 'REVOKED')).toBe(true);
    expect(canTransitionGuardianBindingStatus('ACTIVE', 'PENDING')).toBe(false);
    expect(canTransitionGuardianBindingStatus('REVOKED', 'ACTIVE')).toBe(true);
  });

  it('accepts family view code binding payloads', () => {
    expect(
      bindFamilyViewCodeSchema.safeParse({ familyViewCode: 'ABCD1234' })
        .success,
    ).toBe(true);
    expect(
      bindFamilyViewCodeSchema.safeParse({ familyViewCode: 'short' }).success,
    ).toBe(false);
  });

  it('defaults consent policy version when omitted', () => {
    const parsed = recordGuardianConsentSchema.safeParse({
      studentProfileId: '11111111-1111-4111-8111-111111111111',
      type: 'WORK_DISPLAY',
      granted: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.policyVersion).toBe(
        CURRENT_GUARDIAN_CONSENT_POLICY_VERSION,
      );
    }
  });

  it('describes work display eligibility reasons', () => {
    expect(
      workDisplayEligibilitySchema.safeParse({
        studentProfileId: '11111111-1111-4111-8111-111111111111',
        canDisplayPublicly: false,
        reason: 'WORK_DISPLAY_MISSING',
        policyVersion: null,
      }).success,
    ).toBe(true);
  });
});
