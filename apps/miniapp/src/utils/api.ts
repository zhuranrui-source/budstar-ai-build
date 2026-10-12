/**
 * 小程序端 API 客户端（ADR-0006）：统一走 /api 后端；
 * 微信登录免手机号可浏览，家庭内容触发手机号绑定（一键授权优先）。
 */
const API_BASE_URL =
  process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:3001/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API_${response.status}`);
  }
  return (await response.json()) as T;
}

export type WechatSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  actor: { kind: string; userAccountId: string; displayName: string };
};

export async function wechatLogin(code: string): Promise<WechatSession> {
  return request<WechatSession>('/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function wechatBindPhone(
  accessToken: string,
  code: string,
): Promise<unknown> {
  return request('/auth/wechat/bind-phone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ code }),
  });
}

export { API_BASE_URL };
