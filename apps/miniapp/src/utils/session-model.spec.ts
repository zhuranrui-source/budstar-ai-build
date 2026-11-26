import { describe, expect, it } from 'vitest';
import type { WechatSession } from './api';
import {
  createStoredSession,
  inferPhoneBound,
  isSessionExpired,
  isStoredSession,
  shouldInvalidateSession,
} from './session-model';

const baseSession: WechatSession = {
  accessToken: 'token',
  accessTokenExpiresAt: '2030-01-01T00:00:00.000Z',
  actor: {
    kind: 'parent',
    userAccountId: 'wx-openid-account',
    displayName: '微信用户',
  },
};

describe('session model', () => {
  it('recognizes unbound WeChat accounts and bound phone accounts', () => {
    expect(inferPhoneBound(baseSession)).toBe(false);
    expect(
      inferPhoneBound({
        ...baseSession,
        actor: { ...baseSession.actor, userAccountId: 'parent-phone-account' },
      }),
    ).toBe(true);
  });

  it('marks SMS sessions as phone-bound', () => {
    const stored = createStoredSession(baseSession, 'sms');
    expect(stored.phoneBound).toBe(true);
    expect(isStoredSession(stored)).toBe(true);
  });

  it('only invalidates the session used by the failed request', () => {
    expect(shouldInvalidateSession('new-token', 'old-token')).toBe(false);
    expect(shouldInvalidateSession('current-token', 'current-token')).toBe(
      true,
    );
    expect(shouldInvalidateSession(null, 'old-token')).toBe(false);
  });

  it('expires sessions with a five-second safety window', () => {
    expect(
      isSessionExpired(
        { accessTokenExpiresAt: '2026-01-01T00:00:04.000Z' },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(true);
    expect(
      isSessionExpired(
        { accessTokenExpiresAt: '2026-01-01T00:00:06.000Z' },
        Date.parse('2026-01-01T00:00:00.000Z'),
      ),
    ).toBe(false);
  });
});
