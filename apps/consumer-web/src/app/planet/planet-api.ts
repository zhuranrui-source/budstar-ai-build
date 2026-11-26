import type {
  PlanetCategory,
  PlanetCommentView,
  PlanetPostDetailView,
  PlanetPostView,
  PlanetViewerState,
} from '@budstar/contracts';
import { activeAccessToken } from '../auth-session';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
export const MEDIA_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export class PlanetApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const token = init.auth ? activeAccessToken() : null;
  if (init.auth && !token) throw new PlanetApiError(401, '请先登录');
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(typeof init.body === 'string'
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok) {
    throw new PlanetApiError(
      response.status,
      response.status === 401
        ? '登录已过期，请重新登录'
        : (payload.message ?? '请求失败，请稍后重试'),
    );
  }
  return payload as T;
}

export const planetApi = {
  list: (category?: PlanetCategory, offset = 0) =>
    call<PlanetPostView[]>(
      `/public/planet/posts?offset=${offset}${category ? `&category=${category}` : ''}`,
    ),
  detail: (id: string) =>
    call<PlanetPostDetailView>(
      `/public/planet/posts/${encodeURIComponent(id)}`,
    ),
  states: (ids: string[]) =>
    call<PlanetViewerState[]>(`/planet/states?ids=${ids.join(',')}`, {
      auth: true,
    }),
  like: (id: string) =>
    call<{ liked: boolean; likeCount: number }>(`/planet/posts/${id}/like`, {
      method: 'POST',
      auth: true,
    }),
  favorite: (id: string) =>
    call<{ favorited: boolean; favoriteCount: number }>(
      `/planet/posts/${id}/favorite`,
      { method: 'POST', auth: true },
    ),
  comment: (id: string, body: string) =>
    call<{ comment: PlanetCommentView; status: string }>(
      `/planet/posts/${id}/comments`,
      { method: 'POST', auth: true, body: JSON.stringify({ body }) },
    ),
  favorites: () => call<PlanetPostView[]>('/planet/favorites', { auth: true }),
  mine: () =>
    call<Array<PlanetPostView & { status: string }>>('/planet/mine', {
      auth: true,
    }),
  removeMine: (id: string) =>
    call<{ removed: true }>(`/planet/posts/${id}/remove`, {
      method: 'POST',
      auth: true,
    }),
  upload: (image: Blob) =>
    call<{ url: string }>('/planet/images', {
      method: 'POST',
      auth: true,
      body: image,
      headers: { 'Content-Type': 'image/jpeg' },
    }),
  share: (input: {
    category: 'WORK' | 'COMPETITION';
    title: string;
    body: string;
    imageUrls: string[];
    studentInitial?: string;
    guardianConsent: true;
  }) =>
    call<PlanetPostView & { status: string }>('/planet/posts', {
      method: 'POST',
      auth: true,
      body: JSON.stringify(input),
    }),
};

export const CATEGORY_TABS: Array<{
  id: PlanetCategory | 'ALL';
  label: string;
}> = [
  { id: 'ALL', label: '全部' },
  { id: 'WORK', label: '学生作品' },
  { id: 'COMPETITION', label: '竞赛成果' },
  { id: 'CULTURE', label: '公司文化' },
  { id: 'COURSE', label: '课程内容' },
];

export const CATEGORY_LABEL: Record<PlanetCategory, string> = {
  WORK: '学生作品',
  COMPETITION: '竞赛成果',
  CULTURE: '公司文化',
  COURSE: '课程内容',
};

export function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}
