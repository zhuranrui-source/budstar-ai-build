import type { WechatSession } from './api';

export type LoginMethod = 'wechat' | 'sms';

export type StoredSession = WechatSession & {
  loginMethod: LoginMethod;
  phoneBound: boolean;
};

export function inferPhoneBound(session: WechatSession): boolean {
  return !session.actor.userAccountId.startsWith('wx-');
}

export function createStoredSession(
  session: WechatSession,
  loginMethod: LoginMethod,
  phoneBound = loginMethod === 'sms' || inferPhoneBound(session),
): StoredSession {
  return { ...session, loginMethod, phoneBound };
}

export function isSessionExpired(
  session: Pick<WechatSession, 'accessTokenExpiresAt'>,
  now = Date.now(),
): boolean {
  const expiresAt = Date.parse(session.accessTokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt <= now + 5_000;
}

export function shouldInvalidateSession(
  currentAccessToken: string | null | undefined,
  requestAccessToken: string,
): boolean {
  return (
    Boolean(currentAccessToken) && currentAccessToken === requestAccessToken
  );
}

export function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSession>;
  return Boolean(
    candidate.accessToken &&
    candidate.accessTokenExpiresAt &&
    candidate.actor?.userAccountId &&
    candidate.actor.displayName &&
    (candidate.loginMethod === 'wechat' || candidate.loginMethod === 'sms') &&
    typeof candidate.phoneBound === 'boolean',
  );
}
