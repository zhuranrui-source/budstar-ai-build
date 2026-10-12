import type {
  AuthenticatedSession,
  ConsumerIdentity,
} from '@budstar/contracts';
import {
  identitiesOf,
  resolveLandingIdentity,
  type ConsumerRole,
} from './auth-landing';

export type { ConsumerRole };

export const CONSUMER_SESSION_KEY = 'budstar.consumer.session';
export const CONSUMER_TOKEN_KEY = 'budstar.consumer.token';
export const CONSUMER_ROLE_KEY = 'budstar.consumer.role';
export const LAST_IDENTITY_KEY = 'budstar.consumer.lastIdentity';

/** @deprecated kept for pages mid-migration; prefer activeAccessToken() */
export const PARENT_TOKEN_KEY = 'budstar.parent.token';
/** @deprecated */
export const STUDENT_TOKEN_KEY = 'budstar.student.token';
/** @deprecated */
export const PARENT_SESSION_KEY = 'budstar.parent.session';
/** @deprecated */
export const STUDENT_SESSION_KEY = 'budstar.student.session';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function sessionStore(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function localStore(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function readLastIdentity(): ConsumerIdentity | null {
  const value = localStore()?.getItem(LAST_IDENTITY_KEY);
  return value === 'parent' || value === 'student' ? value : null;
}

export function writeLastIdentity(identity: ConsumerIdentity): void {
  localStore()?.setItem(LAST_IDENTITY_KEY, identity);
}

export function readConsumerRole(): ConsumerRole | null {
  const value = sessionStore()?.getItem(CONSUMER_ROLE_KEY);
  return value === 'parent' || value === 'student' ? value : null;
}

export function writeConsumerRole(role: ConsumerRole): void {
  sessionStore()?.setItem(CONSUMER_ROLE_KEY, role);
  writeLastIdentity(role);
}

export function clearConsumerRole(): void {
  sessionStore()?.removeItem(CONSUMER_ROLE_KEY);
}

export function readConsumerSession(): AuthenticatedSession | null {
  const store = sessionStore();
  if (!store) return null;
  const raw = store.getItem(CONSUMER_SESSION_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AuthenticatedSession;
    } catch {
      store.removeItem(CONSUMER_SESSION_KEY);
    }
  }
  return readParentSession() ?? readStudentSession();
}

export function writeConsumerSession(session: AuthenticatedSession): void {
  const store = sessionStore();
  if (!store) return;
  store.setItem(CONSUMER_SESSION_KEY, JSON.stringify(session));
  store.setItem(CONSUMER_TOKEN_KEY, session.accessToken);
  const identity =
    session.activeIdentity ??
    (session.actor.kind === 'student' ? 'student' : 'parent');
  writeConsumerRole(identity);
  // Mirror into legacy keys so existing pages keep working during migration.
  if (identity === 'parent') {
    writeParentSession(session);
    clearStudentSession();
  } else {
    writeStudentSession(session);
    clearParentSession();
  }
}

export function readParentSession(): AuthenticatedSession | null {
  return readLegacySession(PARENT_SESSION_KEY, PARENT_TOKEN_KEY, 'parent');
}

export function readStudentSession(): AuthenticatedSession | null {
  return readLegacySession(STUDENT_SESSION_KEY, STUDENT_TOKEN_KEY, 'student');
}

export function writeParentSession(session: AuthenticatedSession): void {
  writeLegacySession(PARENT_SESSION_KEY, PARENT_TOKEN_KEY, session);
}

export function writeStudentSession(session: AuthenticatedSession): void {
  writeLegacySession(STUDENT_SESSION_KEY, STUDENT_TOKEN_KEY, session);
}

export function clearParentSession(): void {
  clearLegacySession(PARENT_SESSION_KEY, PARENT_TOKEN_KEY);
}

export function clearStudentSession(): void {
  clearLegacySession(STUDENT_SESSION_KEY, STUDENT_TOKEN_KEY);
}

export function clearAllConsumerSessions(): void {
  const store = sessionStore();
  store?.removeItem(CONSUMER_SESSION_KEY);
  store?.removeItem(CONSUMER_TOKEN_KEY);
  clearParentSession();
  clearStudentSession();
  clearConsumerRole();
}

export function resolveActiveRole(): ConsumerRole | null {
  const session = readConsumerSession();
  if (!session) return null;
  return resolveLandingIdentity({
    session,
    lastIdentity: readConsumerRole() ?? readLastIdentity(),
  });
}

export function activeAccessToken(role?: ConsumerRole | null): string | null {
  const session = readConsumerSession();
  if (!session) return null;
  const resolved = role ?? resolveActiveRole();
  if (!resolved) return null;
  const identities = identitiesOf(session);
  if (identities.length && !identities.includes(resolved)) {
    return null;
  }
  return session.accessToken;
}

function readLegacySession(
  sessionKey: string,
  tokenKey: string,
  kind: ConsumerIdentity,
): AuthenticatedSession | null {
  const store = sessionStore();
  if (!store) return null;
  const raw = store.getItem(sessionKey);
  if (raw) {
    try {
      return JSON.parse(raw) as AuthenticatedSession;
    } catch {
      store.removeItem(sessionKey);
    }
  }
  const token = store.getItem(tokenKey);
  if (!token) return null;
  return {
    accessToken: token,
    accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    actor: {
      kind,
      userAccountId: 'unknown',
      displayName: kind === 'parent' ? '家长用户' : '学生用户',
    },
    availableIdentities: [kind],
    activeIdentity: kind,
    campuses: [],
  };
}

function writeLegacySession(
  sessionKey: string,
  tokenKey: string,
  session: AuthenticatedSession,
): void {
  const store = sessionStore();
  if (!store) return;
  store.setItem(sessionKey, JSON.stringify(session));
  store.setItem(tokenKey, session.accessToken);
}

function clearLegacySession(sessionKey: string, tokenKey: string): void {
  const store = sessionStore();
  if (!store) return;
  store.removeItem(sessionKey);
  store.removeItem(tokenKey);
}
