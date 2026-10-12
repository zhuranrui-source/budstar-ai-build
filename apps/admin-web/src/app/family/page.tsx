'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../auth-client';
import { OpsShell } from '../ops-shell';

type StudentItem = {
  id: string;
  displayName: string;
  hasFamilyViewCode: boolean;
  familyViewCodeUpdatedAt: string | null;
  activeBindingCount: number;
};

type BindingItem = {
  id: string;
  studentDisplayName: string;
  studentProfileId: string;
  status: string;
  updatedAt: string;
};

const CAMPUS_KEY = 'budstar.admin.campus';

export default function FamilyPage() {
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
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [bindings, setBindings] = useState<BindingItem[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
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
        const [nextStudents, nextBindings] = await Promise.all([
          client.listStudents(campusId),
          client.listFamilyBindings(campusId),
        ]);
        if (cancelled) return;
        setStudents(nextStudents);
        setBindings(nextBindings);
        setBootstrapped(true);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setError(
          cause instanceof ForbiddenError
            ? '无权访问该校区家庭数据'
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
  }, [campusId, client]);

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
          ? '无权访问该校区家庭数据'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const [nextStudents, nextBindings] = await Promise.all([
      client.listStudents(campusId),
      client.listFamilyBindings(campusId),
    ]);
    setStudents(nextStudents);
    setBindings(nextBindings);
  }

  async function createStudent(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const created = await client.createStudent(campusId, { displayName });
      setDisplayName('');
      setIssuedCode(created.familyViewCode);
      await refresh();
    });
  }

  async function resetCode(studentProfileId: string) {
    await run(async () => {
      const issued = await client.resetFamilyViewCode(
        campusId,
        studentProfileId,
      );
      setIssuedCode(issued.familyViewCode);
      await refresh();
    });
  }

  async function revokeBinding(bindingId: string) {
    await run(async () => {
      await client.revokeFamilyBinding(campusId, bindingId);
      await refresh();
    });
  }

  if (!bootstrapped) {
    return (
      <main className="ops-redirect">
        <span>正在加载家庭绑定…</span>
      </main>
    );
  }

  return (
    <OpsShell
      active="family"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>家庭沟通</p>
            <h1>家庭查看码与绑定</h1>
          </div>
          <div className="ops-status">{campusId}</div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        {issuedCode && (
          <div role="status">
            <div>
              <p>请妥善告知家长</p>
              <h2>家庭查看码：{issuedCode}</h2>
              <p>该码仅在此展示一次明文，重置后旧码立即失效。</p>
            </div>
          </div>
        )}
        <section>
          <p>创建学生档案</p>
          <h2>生成家庭查看码</h2>
          <form className="ops-form" onSubmit={createStudent}>
            <label>
              学生姓名
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </label>
            <button className="ops-primary" disabled={loading}>
              {loading ? '处理中…' : '创建并生成查看码'}
            </button>
          </form>
        </section>
        <section className="ops-class-list">
          {students.map((student) => (
            <article key={student.id}>
              <span>
                {student.hasFamilyViewCode ? '已发放查看码' : '未发放查看码'} ·
                绑定 {student.activeBindingCount}
              </span>
              <strong>{student.displayName}</strong>
              <small>
                {student.familyViewCodeUpdatedAt
                  ? `更新于 ${new Date(student.familyViewCodeUpdatedAt).toLocaleString('zh-CN')}`
                  : '尚未生成查看码'}
              </small>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="ops-text-button"
                  onClick={() => void resetCode(student.id)}
                  disabled={loading}
                >
                  重置查看码
                </button>
              </div>
            </article>
          ))}
        </section>
        <section style={{ marginTop: 24 }}>
          <div>
            <p>绑定状态</p>
            <h2>校区家庭绑定</h2>
            {bindings.length === 0 ? (
              <p>暂无绑定记录。</p>
            ) : (
              <ul>
                {bindings.map((binding) => (
                  <li key={binding.id}>
                    {binding.studentDisplayName} · {binding.status} ·{' '}
                    {new Date(binding.updatedAt).toLocaleString('zh-CN')}
                    {binding.status === 'ACTIVE' && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="ops-text-button"
                          onClick={() => void revokeBinding(binding.id)}
                          disabled={loading}
                        >
                          撤销
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </>
    </OpsShell>
  );
}
