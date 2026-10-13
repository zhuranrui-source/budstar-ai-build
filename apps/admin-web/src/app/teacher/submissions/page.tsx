'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';

type SubmissionItem = {
  id: string;
  className: string;
  studentDisplayName: string;
  lessonTitle: string;
  lessonSequence: number;
  track: string;
  status: string;
  title: string;
  updatedAt: string;
  submittedAt: string | null;
};

type SubmissionDetail = SubmissionItem & {
  content: Record<string, unknown>;
};

const CAMPUS_KEY = 'budstar.admin.campus';
const STATUS_OPTIONS = [
  'DRAFT',
  'SUBMITTED',
  'NEEDS_REVISION',
  'RESUBMITTED',
  'COMPLETED',
] as const;

const TEACHER_NEXT: Record<string, string[]> = {
  SUBMITTED: ['NEEDS_REVISION', 'COMPLETED'],
  RESUBMITTED: ['NEEDS_REVISION', 'COMPLETED'],
};

export default function SubmissionsPage() {
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
  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [selected, setSelected] = useState<SubmissionDetail | null>(null);
  const [toStatus, setToStatus] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const session = client.readSession();
      if (!session) {
        window.location.replace('/login');
        return;
      }
      if (!campusId) {
        window.location.replace('/');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const next = await client.listSubmissions(campusId, {
          status: statusFilter || undefined,
        });
        if (cancelled) return;
        setItems(next);
        setBootstrapped(true);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setError(
          cause instanceof ForbiddenError
            ? '无权访问该校区提交队列'
            : cause instanceof ApiRequestError
              ? cause.message
              : '服务暂时不可用，请稍后重试',
        );
        setBootstrapped(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId, client, statusFilter]);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(
        cause instanceof ForbiddenError
          ? '无权访问该校区提交队列'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setItems(
      await client.listSubmissions(campusId, {
        status: statusFilter || undefined,
      }),
    );
  }

  async function openItem(item: SubmissionItem) {
    await run(async () => {
      const detail = await client.getSubmission(campusId, item.id);
      setSelected(detail);
      setToStatus(TEACHER_NEXT[detail.status]?.[0] ?? '');
      setNote('');
    });
  }

  async function transition(event: FormEvent) {
    event.preventDefault();
    if (!selected || !toStatus) return;
    await run(async () => {
      await client.transitionSubmission(campusId, selected.id, {
        toStatus,
        note: note || undefined,
      });
      setSelected(null);
      await refresh();
    });
  }

  if (!bootstrapped) {
    return (
      <main className="ops-redirect">
        <span>正在加载提交队列…</span>
      </main>
    );
  }

  return (
    <OpsShell
      active="submissions"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>课程交付</p>
            <h1>作品提交队列</h1>
          </div>
          <div className="ops-status">{campusId}</div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        <section>
          <form
            className="ops-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(refresh);
            }}
          >
            <label>
              状态筛选
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">全部</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="ops-primary" disabled={loading}>
              刷新
            </button>
          </form>
        </section>
        <section className="ops-class-list">
          {items.map((item) => (
            <article key={item.id}>
              <span>
                {item.status} · {item.track}
              </span>
              <strong>{item.title}</strong>
              <small>
                {item.studentDisplayName} · {item.className} · 第
                {item.lessonSequence}课 {item.lessonTitle}
              </small>
              <button
                type="button"
                className="ops-text-button"
                onClick={() => void openItem(item)}
              >
                打开详情
              </button>
            </article>
          ))}
        </section>
        {selected && (
          <section style={{ marginTop: 24 }}>
            <div style={{ width: '100%' }}>
              <p>提交详情</p>
              <h2>
                {selected.title} · {selected.status}
              </h2>
              <p>
                {selected.studentDisplayName} · {selected.className} ·{' '}
                {selected.lessonTitle}
              </p>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  background: '#f3f0e9',
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                {JSON.stringify(selected.content, null, 2)}
              </pre>
              {TEACHER_NEXT[selected.status] && (
                <form className="ops-form" onSubmit={transition}>
                  <label>
                    流转到
                    <select
                      value={toStatus}
                      onChange={(event) => setToStatus(event.target.value)}
                      required
                    >
                      {TEACHER_NEXT[selected.status]?.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    备注
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="需修改说明（可选）"
                    />
                  </label>
                  <button className="ops-primary" disabled={loading}>
                    确认流转
                  </button>
                </form>
              )}
            </div>
          </section>
        )}
      </>
    </OpsShell>
  );
}
