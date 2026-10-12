'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../auth-client';
import { OpsShell } from '../ops-shell';

const CAMPUS_KEY = 'budstar.admin.campus';

type ModerationItem = {
  id: string;
  campusId: string;
  classId: string | null;
  studentProfileId: string;
  studentDisplayName: string;
  title: string;
  body: string;
  visibilityScope: string;
  riskLevel: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
};

export default function ModerationPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const campusId =
    typeof window === 'undefined'
      ? ''
      : (window.sessionStorage.getItem(CAMPUS_KEY) ?? '');
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  async function run(action: () => Promise<void>) {
    if (!campusId) {
      setError('请先选择校区');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(
        cause instanceof ForbiddenError
          ? '无权执行社区审核'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const next = await client.listModerationQueue(campusId);
    setItems(next);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!campusId) {
        setError('请先选择校区');
        setBootstrapped(true);
        return;
      }
      setLoading(true);
      try {
        const next = await client.listModerationQueue(campusId);
        if (!cancelled) setItems(next);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setError(
          cause instanceof ForbiddenError
            ? '无权查看审核队列'
            : cause instanceof ApiRequestError
              ? cause.message
              : '服务暂时不可用，请稍后重试',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId, client]);

  async function review(postId: string, action: 'approve' | 'reject' | 'hide') {
    await run(async () => {
      await client.reviewCommunityPost(campusId, postId, { action });
      await refresh();
      const label =
        action === 'approve'
          ? '已通过'
          : action === 'reject'
            ? '已拒绝'
            : '已隐藏';
      setMessage(`${label}：${postId}`);
    });
  }

  if (!bootstrapped) {
    return (
      <main className="ops-redirect">
        <span>正在加载社区审核队列…</span>
      </main>
    );
  }

  return (
    <OpsShell
      active="moderation"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>封闭社区</p>
            <h1>星芽星球内容审核</h1>
          </div>
          <div className="ops-status">{campusId}</div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        {message && <p role="status">{message}</p>}
        <section>
          <form
            className="ops-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(refresh);
            }}
          >
            <p>展示本校区待审核与已隐藏内容；中高风险须人工处置。</p>
            <button className="ops-primary" disabled={loading}>
              刷新队列
            </button>
          </form>
        </section>
        <section className="ops-class-list">
          {items.length === 0 && !loading && <p>当前无待处理内容。</p>}
          {items.map((item) => (
            <article key={item.id}>
              <span>
                {item.status} · {item.riskLevel} · {item.visibilityScope}
              </span>
              <strong>{item.title}</strong>
              <small>
                {item.studentDisplayName} · {item.createdAt}
              </small>
              <p>{item.body}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="ops-primary"
                  disabled={loading || item.status === 'PUBLISHED'}
                  onClick={() => void review(item.id, 'approve')}
                >
                  通过
                </button>
                <button
                  type="button"
                  className="ops-text-button"
                  disabled={loading || item.status === 'REJECTED'}
                  onClick={() => void review(item.id, 'reject')}
                >
                  拒绝
                </button>
                <button
                  type="button"
                  className="ops-text-button"
                  disabled={loading || item.status === 'HIDDEN'}
                  onClick={() => void review(item.id, 'hide')}
                >
                  隐藏
                </button>
              </div>
            </article>
          ))}
        </section>
      </>
    </OpsShell>
  );
}
