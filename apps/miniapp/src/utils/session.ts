import Taro from '@tarojs/taro';
import type { WechatSession } from './api';
import { PREVIEW_MODE, PREVIEW_SESSION } from './preview';
import {
  createStoredSession,
  isSessionExpired,
  isStoredSession,
  shouldInvalidateSession,
  type LoginMethod,
  type StoredSession,
} from './session-model';

export type { StoredSession } from './session-model';

const SESSION_KEY = 'budstar.session';
const LOGIN_NOTICE_KEY = 'budstar.loginNotice';
const SKIP_AUTO_LOGIN_KEY = 'budstar.skipAutoLoginOnce';

export function saveSession(
  session: WechatSession,
  loginMethod: LoginMethod,
  phoneBound?: boolean,
): StoredSession {
  const stored = createStoredSession(session, loginMethod, phoneBound);
  Taro.setStorageSync(SESSION_KEY, stored);
  // Keep these keys during one release for users upgrading from the old build.
  Taro.setStorageSync('accessToken', stored.accessToken);
  Taro.setStorageSync('displayName', stored.actor.displayName);
  return stored;
}

export function getSession(): StoredSession | null {
  if (PREVIEW_MODE) return createStoredSession(PREVIEW_SESSION, 'wechat', true);
  const stored: unknown = Taro.getStorageSync(SESSION_KEY);
  if (isStoredSession(stored)) return stored;

  const legacyToken = Taro.getStorageSync('accessToken') as string;
  if (!legacyToken) return null;
  const migrated: StoredSession = {
    accessToken: legacyToken,
    // Legacy sessions had no expiry. The API will reject an expired token safely.
    accessTokenExpiresAt: '',
    actor: {
      kind: 'parent',
      userAccountId: 'legacy-parent',
      displayName: (Taro.getStorageSync('displayName') as string) || '家长用户',
    },
    loginMethod: 'wechat',
    phoneBound: false,
  };
  Taro.setStorageSync(SESSION_KEY, migrated);
  return migrated;
}

export function getValidSession(): StoredSession | null {
  const session = getSession();
  if (!session) return null;
  if (isSessionExpired(session)) {
    clearSession();
    setLoginNotice('登录已过期，请重新登录');
    return null;
  }
  return session;
}

export function clearSession(): void {
  Taro.removeStorageSync(SESSION_KEY);
  Taro.removeStorageSync('accessToken');
  Taro.removeStorageSync('displayName');
}

export function clearSessionIfToken(accessToken: string): boolean {
  const current = getSession();
  if (!shouldInvalidateSession(current?.accessToken, accessToken)) return false;
  clearSession();
  return true;
}

export function setLoginNotice(message: string): void {
  Taro.setStorageSync(LOGIN_NOTICE_KEY, message);
}

export function consumeLoginNotice(): string {
  const message = (Taro.getStorageSync(LOGIN_NOTICE_KEY) as string) || '';
  if (message) Taro.removeStorageSync(LOGIN_NOTICE_KEY);
  return message;
}

export function suppressNextAutoLogin(): void {
  Taro.setStorageSync(SKIP_AUTO_LOGIN_KEY, true);
}

export function consumeAutoLoginSuppression(): boolean {
  const suppressed = Boolean(Taro.getStorageSync(SKIP_AUTO_LOGIN_KEY));
  if (suppressed) Taro.removeStorageSync(SKIP_AUTO_LOGIN_KEY);
  return suppressed;
}

/** 需要身份时再登录：打开登录页，登录成功后返回原页面。 */
export function goToLogin(message?: string): void {
  if (message) setLoginNotice(message);
  const pages = Taro.getCurrentPages();
  if (pages[pages.length - 1]?.route === 'pages/login/index') return;
  void Taro.navigateTo({ url: '/pages/login/index' });
}

export function requireSession(): StoredSession | null {
  const session = getValidSession();
  if (!session) goToLogin();
  return session;
}
