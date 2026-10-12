import { describe, expect, it } from 'vitest';
import type { AuthenticatedSession } from '@budstar/contracts';
import {
  landingPathForIdentity,
  needsIdentityChoice,
  resolveLandingIdentity,
} from './auth-landing';

function session(
  partial: Partial<AuthenticatedSession> & {
    kind?: 'parent' | 'student';
  },
): AuthenticatedSession {
  const kind = partial.kind ?? 'parent';
  return {
    accessToken: 'token',
    accessTokenExpiresAt: new Date().toISOString(),
    actor: {
      kind,
      userAccountId: 'user-1',
      displayName: kind === 'parent' ? '家长用户' : '学生用户',
    },
    campuses: [],
    availableIdentities: partial.availableIdentities,
    activeIdentity: partial.activeIdentity ?? kind,
  };
}

describe('auth landing rules', () => {
  it('defaults phone-first accounts to parent when no last identity', () => {
    expect(
      resolveLandingIdentity({
        session: session({
          kind: 'parent',
          availableIdentities: ['parent'],
          activeIdentity: 'parent',
        }),
        lastIdentity: null,
      }),
    ).toBe('parent');
  });

  it('restores last identity when both are available', () => {
    expect(
      resolveLandingIdentity({
        session: session({
          availableIdentities: ['parent', 'student'],
          activeIdentity: 'parent',
        }),
        lastIdentity: 'student',
      }),
    ).toBe('student');
  });

  it('forces student for student-number bypass login', () => {
    expect(
      resolveLandingIdentity({
        session: session({
          kind: 'student',
          availableIdentities: ['student'],
          activeIdentity: 'student',
        }),
        lastIdentity: 'parent',
        forceIdentity: 'student',
      }),
    ).toBe('student');
  });

  it('asks for a choice only when both identities exist and no last identity', () => {
    expect(
      needsIdentityChoice({
        session: session({
          availableIdentities: ['parent', 'student'],
        }),
        lastIdentity: null,
      }),
    ).toBe(true);
    expect(
      needsIdentityChoice({
        session: session({
          availableIdentities: ['parent', 'student'],
        }),
        lastIdentity: 'parent',
      }),
    ).toBe(false);
    expect(
      needsIdentityChoice({
        session: session({
          availableIdentities: ['parent'],
        }),
        lastIdentity: null,
      }),
    ).toBe(false);
  });

  it('maps identities to landing paths', () => {
    expect(landingPathForIdentity('parent')).toBe('/family');
    expect(landingPathForIdentity('student')).toBe('/learning');
  });
});
