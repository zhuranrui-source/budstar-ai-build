'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';

type ClassItem = {
  id: string;
  name: string;
  classCode: string;
  status: string;
  coursePackageTitle: string;
  coursePackageVersion: string;
  studentCount: number;
};

type PublishedPackage = {
  id: string;
  title: string;
  version: string;
};

type StudentItem = {
  studentProfileId: string;
  displayName: string;
  joinedAt: string;
};

const CAMPUS_KEY = 'budstar.admin.campus';

export default function ClassesPage() {
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
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [packages, setPackages] = useState<PublishedPackage[]>([]);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [name, setName] = useState('');
  const [versionId, setVersionId] = useState('');
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
        const [nextClasses, nextPackages] = await Promise.all([
          client.listClasses(campusId),
          client.listPublishedCoursePackages(campusId),
        ]);
        if (cancelled) return;
        setClasses(nextClasses);
        setPackages(nextPackages);
        setVersionId((current) => current || nextPackages[0]?.id || '');
        setBootstrapped(true);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setError(
          cause instanceof ForbiddenError
            ? '无权访问该校区班级数据'
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
          ? '无权访问该校区班级数据'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    const [nextClasses, nextPackages] = await Promise.all([
      client.listClasses(campusId),
      client.listPublishedCoursePackages(campusId),
    ]);
    setClasses(nextClasses);
    setPackages(nextPackages);
    setVersionId((current) => current || nextPackages[0]?.id || '');
  }

  async function createClass(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await client.createClass(campusId, {
        name,
        coursePackageVersionId: versionId,
      });
      setName('');
      await refresh();
    });
  }

  async function advanceStatus(item: ClassItem) {
    const next =
      item.status === 'DRAFT'
        ? 'ACTIVE'
        : item.status === 'ACTIVE'
          ? 'CLOSED'
          : null;
    if (!next) return;
    await run(async () => {
      await client.updateClass(campusId, item.id, { status: next });
      await refresh();
    });
  }

  async function openStudents(classId: string) {
    setSelectedClassId(classId);
    await run(async () => {
      setStudents(await client.listClassStudents(campusId, classId));
    });
  }

  if (!bootstrapped) {
    return (
      <main className="ops-redirect">
        <span>正在加载班级管理…</span>
      </main>
    );
  }

  return (
    <OpsShell
      active="classes"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>校区运营</p>
            <h1>班级管理</h1>
          </div>
          <div className="ops-status">{campusId}</div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        <section>
          <p>创建班级</p>
          <h2>绑定已发布课程包版本</h2>
          <form className="ops-form" onSubmit={createClass}>
            <label>
              班级名称
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label>
              课程包版本
              <select
                value={versionId}
                onChange={(event) => setVersionId(event.target.value)}
                required
              >
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} · v{item.version}
                  </option>
                ))}
              </select>
            </label>
            <button className="ops-primary" disabled={loading}>
              {loading ? '处理中…' : '创建班级'}
            </button>
          </form>
        </section>
        <section className="ops-class-list">
          {classes.map((item) => (
            <article key={item.id}>
              <span>
                {item.coursePackageTitle} · v{item.coursePackageVersion}
              </span>
              <strong>{item.name}</strong>
              <small>
                班级码 {item.classCode} · {item.status} · {item.studentCount}{' '}
                名学生
              </small>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="ops-text-button"
                  onClick={() => void advanceStatus(item)}
                  disabled={item.status === 'CLOSED' || loading}
                >
                  推进状态
                </button>
                <button
                  type="button"
                  className="ops-text-button"
                  onClick={() => void openStudents(item.id)}
                >
                  学生列表
                </button>
              </div>
            </article>
          ))}
        </section>
        {selectedClassId && (
          <section style={{ marginTop: 24 }}>
            <div>
              <p>只读学生列表</p>
              <h2>班级学生</h2>
              {students.length === 0 ? (
                <p>暂无学生加入。</p>
              ) : (
                <ul>
                  {students.map((student) => (
                    <li key={student.studentProfileId}>
                      {student.displayName} ·{' '}
                      {new Date(student.joinedAt).toLocaleString('zh-CN')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </>
    </OpsShell>
  );
}
