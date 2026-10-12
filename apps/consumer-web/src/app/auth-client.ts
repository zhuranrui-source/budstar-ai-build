import type {
  AuthenticatedSession,
  ConsumerIdentity,
} from '@budstar/contracts';
import {
  activeAccessToken,
  clearAllConsumerSessions,
  writeConsumerSession,
} from './auth-session';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class ConsumerAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function publicPost<T>(
  path: string,
  body: unknown,
  fetcher: FetchLike = fetch,
): Promise<T> {
  const response = await fetcher(`${apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    code?: string;
    message?: string;
  } & T;
  if (!response.ok) {
    throw new ConsumerAuthError(
      response.status,
      payload.code ?? 'INTERNAL_ERROR',
      payload.message ?? '请求失败',
    );
  }
  return payload;
}

export async function requestParentOtp(
  phone: string,
  fetcher: FetchLike = fetch,
): Promise<{ sent: true }> {
  return publicPost('/auth/parent/request-otp', { phone }, fetcher);
}

export async function verifyParentOtp(
  phone: string,
  code: string,
  fetcher: FetchLike = fetch,
): Promise<AuthenticatedSession> {
  const session = await publicPost<AuthenticatedSession>(
    '/auth/parent/verify-otp',
    { phone, code },
    fetcher,
  );
  writeConsumerSession(session);
  return session;
}

export async function loginStudent(
  loginIdentifier: string,
  password: string,
  fetcher: FetchLike = fetch,
): Promise<AuthenticatedSession> {
  const session = await publicPost<AuthenticatedSession>(
    '/auth/student/login',
    { loginIdentifier, password },
    fetcher,
  );
  writeConsumerSession(session);
  return session;
}

export async function switchConsumerIdentity(
  identity: ConsumerIdentity,
  fetcher: FetchLike = fetch,
): Promise<AuthenticatedSession> {
  const accessToken = activeAccessToken();
  if (!accessToken) {
    throw new ConsumerAuthError(401, 'UNAUTHORIZED', '请先登录');
  }
  const response = await fetcher(
    `${apiBaseUrl}/auth/consumer/switch-identity`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ identity }),
    },
  );
  const payload = (await response.json()) as {
    code?: string;
    message?: string;
  } & AuthenticatedSession;
  if (!response.ok) {
    throw new ConsumerAuthError(
      response.status,
      payload.code ?? 'INTERNAL_ERROR',
      payload.message ?? '切换身份失败',
    );
  }
  writeConsumerSession(payload);
  return payload;
}

export async function logoutConsumer(
  fetcher: FetchLike = fetch,
): Promise<void> {
  const token = activeAccessToken();
  clearAllConsumerSessions();
  if (!token) return;
  try {
    await fetcher(`${apiBaseUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Local logout is authoritative.
  }
}
