import Taro from '@tarojs/taro';
import { PREVIEW_MODE, previewRequest } from './preview';
import { clearSessionIfToken, goToLogin } from './session';

const API_BASE_URL =
  process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3001/api';

export type ApiErrorBody = {
  code?: string;
  message?: string;
  details?: unknown;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
};

function errorMessage(status: number, body: ApiErrorBody): string {
  if (body.message) return body.message;
  if (status === 401) return '登录已过期，请重新登录';
  if (status === 403) return '当前账号无权执行此操作';
  if (status === 404) return '请求的内容不存在';
  if (status === 429) return '操作过于频繁，请稍后再试';
  if (status >= 500) return '服务暂时不可用，请稍后再试';
  return '请求失败，请稍后重试';
}

export async function request<T>(
  path: string,
  accessToken?: string,
  options: RequestOptions = {},
): Promise<T> {
  if (PREVIEW_MODE) return previewRequest<T>(path, options);
  try {
    const response = await Taro.request<T | ApiErrorBody>({
      url: `${API_BASE_URL}${path}`,
      method: options.method ?? 'GET',
      data: options.body,
      timeout: options.timeout ?? 15_000,
      header: {
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(options.headers ?? {}),
      },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const body =
        response.data && typeof response.data === 'object'
          ? (response.data as ApiErrorBody)
          : {};
      const error = new ApiError(
        response.statusCode,
        body.code ?? `HTTP_${response.statusCode}`,
        errorMessage(response.statusCode, body),
        body.details,
      );
      if (
        response.statusCode === 401 &&
        accessToken &&
        clearSessionIfToken(accessToken)
      ) {
        goToLogin(error.message);
      }
      throw error;
    }

    return response.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const detail =
      error && typeof error === 'object' && 'errMsg' in error
        ? String(error.errMsg)
        : '';
    const timeout = /timeout/i.test(detail);
    throw new ApiError(
      0,
      timeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      timeout ? '请求超时，请稍后重试' : '网络连接失败，请检查网络后重试',
    );
  }
}

export type WechatSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  actor: { kind: string; userAccountId: string; displayName: string };
  availableIdentities?: string[];
  activeIdentity?: string;
  campuses?: Array<{ id: string; name: string; roles: string[] }>;
};

export async function wechatLogin(code: string): Promise<WechatSession> {
  return request<WechatSession>('/auth/wechat/login', undefined, {
    method: 'POST',
    body: { code },
  });
}

export async function wechatBindPhone(
  accessToken: string,
  code: string,
): Promise<WechatSession> {
  return request<WechatSession>('/auth/wechat/bind-phone', accessToken, {
    method: 'POST',
    body: { code },
  });
}

export async function requestParentOtp(phone: string): Promise<void> {
  await request<{ sent: true }>('/auth/parent/request-otp', undefined, {
    method: 'POST',
    body: { phone },
  });
}

export async function verifyParentOtp(
  phone: string,
  code: string,
): Promise<WechatSession> {
  return request<WechatSession>('/auth/parent/verify-otp', undefined, {
    method: 'POST',
    body: { phone, code },
  });
}

export { API_BASE_URL };

export type PublicCampus = { id: string; name: string };

export async function listPublicCampuses(): Promise<PublicCampus[]> {
  return request<PublicCampus[]>('/public/campuses');
}

export type AppointmentLeadInput = {
  parentName: string;
  phone: string;
  childAgeOrGrade: string;
  interestedCourse: string;
  campusId: string;
  preferredContactTime: string;
};

export async function createAppointmentLead(
  input: AppointmentLeadInput,
  idempotencyKey: string,
): Promise<void> {
  await request<unknown>('/public/appointment-leads', undefined, {
    method: 'POST',
    body: input,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}
