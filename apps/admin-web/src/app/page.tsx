'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AuthenticatedSession } from '@budstar/contracts';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from './auth-client';
import { OpsShell } from './ops-shell';
import { adminSessionRedirect } from './session-routing';

export default function Home() {
  return <AdminWorkspace />;
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M3 10c2.2 3 5.3 5 9 5s6.8-2 9-5M7 14l-1.6 2.4M12 15v3M17 14l1.6 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AdminWorkspace({ loginOnly = false }: { loginOnly?: boolean }) {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let active = true;
    void client
      .restoreSession()
      .then(async (storedSession) => {
        if (!active) return;
        setSession(storedSession);
        const storedCampus =
          window.sessionStorage.getItem('budstar.admin.campus') ?? '';
        if (storedCampus && storedSession?.actor.kind === 'staff') {
          setSelectedCampus(storedCampus);
          try {
            await client.getCampusOverview(storedCampus);
          } catch {
            window.sessionStorage.removeItem('budstar.admin.campus');
            setSelectedCampus('');
          }
        }
        const redirect = adminSessionRedirect(
          Boolean(storedSession),
          loginOnly,
        );
        if (redirect) window.location.replace(redirect);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ForbiddenError) client.clearSession();
        window.location.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [client, loginOnly]);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        setSession(null);
        window.location.replace('/login');
        return;
      }
      if (cause instanceof ForbiddenError) {
        setForbidden(true);
        return;
      }
      setError(
        cause instanceof ApiRequestError
          ? cause.message
          : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function enterWorkspace(nextSession: AuthenticatedSession) {
    setSession(nextSession);
    if (loginOnly && nextSession.actor.kind === 'platform-admin') {
      window.location.replace('/');
      return;
    }
    if (loginOnly) window.location.replace('/');
  }

  /** 登录阶段的错误就地提示，不进入“无权访问”页面。 */
  async function runLogin(
    action: () => Promise<void>,
    unauthorizedMessage: string,
  ) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError
          ? cause.status === 401
            ? unauthorizedMessage
            : cause.message
          : '网络异常，请检查网络后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (!loginIdentifier.trim() || !password) {
      setError('请填写账号和密码');
      return;
    }
    await runLogin(async () => {
      await enterWorkspace(
        await client.adminLogin(loginIdentifier.trim(), password),
      );
    }, '账号或密码不正确');
  }

  async function chooseCampus(campusId: string) {
    await run(async () => {
      await client.selectCampus(campusId);
      setSelectedCampus(campusId);
      window.sessionStorage.setItem('budstar.admin.campus', campusId);
      await client.getCampusOverview(campusId);
    });
  }

  const [stats, setStats] = useState<{
    courses: number | null;
    chapters: number | null;
    consumerAccounts: number | null;
  }>({ courses: null, chapters: null, consumerAccounts: null });

  useEffect(() => {
    if (!session) return;
    let active = true;
    void (async () => {
      const [courses, accounts] = await Promise.allSettled([
        client.listSubjectCourses(),
        session.actor.kind === 'platform-admin'
          ? client.listConsumerAccounts()
          : Promise.resolve([]),
      ]);
      if (!active) return;
      setStats({
        courses:
          courses.status === 'fulfilled'
            ? courses.value.filter((course) => course.status === 'PUBLISHED')
                .length
            : null,
        chapters:
          courses.status === 'fulfilled'
            ? courses.value.reduce(
                (sum, course) => sum + (course.chapterCount ?? 0),
                0,
              )
            : null,
        consumerAccounts:
          accounts.status === 'fulfilled' ? accounts.value.length : null,
      });
    })();
    return () => {
      active = false;
    };
  }, [client, session]);

  async function logout() {
    await client.logout();
    window.sessionStorage.removeItem('budstar.admin.campus');
    setSession(null);
    setSelectedCampus('');
    window.location.replace('/login');
  }

  async function recoverFromForbidden() {
    setForbidden(false);
    try {
      const restored = await client.restoreSession();
      if (!restored) {
        window.location.replace('/login');
        return;
      }
      setSession(restored);
      setSelectedCampus('');
    } catch {
      client.clearSession();
      window.location.replace('/login');
    }
  }

  if (forbidden) {
    return (
      <main className="ops-redirect">
        <section className="ops-login-card">
          <span className="ops-kicker">访问受限</span>
          <h1>无权访问</h1>
          <p>当前账号没有访问此区域的权限。</p>
          <button
            className="ops-primary"
            type="button"
            onClick={() => void recoverFromForbidden()}
          >
            重新验证并返回工作台
          </button>
        </section>
      </main>
    );
  }

  if (!session && !loginOnly) {
    return (
      <main className="ops-redirect">
        <span>正在前往安全登录页…</span>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="ops-login">
        <section className="ops-login-card">
          <span className="ops-kicker">BUDSTAR AI · 机构工作台</span>
          <h1>登录机构后台</h1>
          <p>使用员工或平台管理员账号登录，系统会自动识别身份。</p>
          <form onSubmit={submitLogin} className="ops-login-form">
            <label>
              账号
              <input
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
            </label>
            <label>
              密码
              <span className="ops-password-line">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="ops-password-toggle"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                </button>
              </span>
            </label>
            {error && (
              <div className="ops-login-error" role="alert">
                {error}
              </div>
            )}
            <button className="ops-primary" disabled={loading}>
              {loading ? '正在登录…' : '登录'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  const isPlatformAdmin = session.actor.kind === 'platform-admin';
  const currentCampus = session.campuses.find(
    (campus) => campus.id === selectedCampus,
  );
  const roleLabel = isPlatformAdmin
    ? '平台管理员'
    : (currentCampus?.name ?? '请选择校区');

  return (
    <OpsShell
      active="desk"
      displayName={session.actor.displayName}
      roleLabel={roleLabel}
      isPlatformAdmin={isPlatformAdmin}
      onLogout={() => void logout()}
    >
      <header className="ops-page-head">
        <div>
          <h1>工作台</h1>
          <p>你好，{session.actor.displayName}</p>
        </div>
      </header>

      {error && (
        <div
          className="ops-login-error"
          role="alert"
          style={{ marginBottom: 16 }}
        >
          {error}
        </div>
      )}

      {!isPlatformAdmin && !selectedCampus && session.campuses.length > 1 ? (
        <div className="ops-class-list">
          {session.campuses.map((campus) => (
            <button
              key={campus.id}
              type="button"
              disabled={loading}
              onClick={() => void chooseCampus(campus.id)}
            >
              <span className="ops-class-cover">{campus.name.slice(0, 1)}</span>
              <span>
                <b>{campus.name}</b>
                <small>{campus.roles.join(' · ')}</small>
              </span>
              <strong>进入</strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="ops-module-grid">
          {(isPlatformAdmin
            ? [
                {
                  title: '学科内容库',
                  value:
                    stats.courses === null
                      ? '—'
                      : `${stats.courses} 门 · ${stats.chapters} 章`,
                  description: '互动实验室课程的编辑与发布',
                  href: '/platform/subject-courses',
                },
                {
                  title: '线索 CRM',
                  value: '预约跟进',
                  description: '官网和小程序提交的到校体验预约',
                  href: '/platform/leads',
                },
                {
                  title: '客户账号',
                  value:
                    stats.consumerAccounts === null
                      ? '—'
                      : `${stats.consumerAccounts} 个`,
                  description: '为官网客户统一分配账号密码',
                  href: '/platform/consumer-accounts',
                },
                {
                  title: '星芽星球',
                  value: '查看前台',
                  description: '学生作品、竞赛成果与公司文化展示',
                  href: 'https://budstar-ai.site/planet',
                },
              ]
            : [
                {
                  title: '星芽星球',
                  value: '查看前台',
                  description: '学生作品、竞赛成果与公司文化展示',
                  href: 'https://budstar-ai.site/planet',
                },
              ]
          ).map((item) => (
            <a key={item.title} className="ops-module-card" href={item.href}>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <small>{item.description}</small>
            </a>
          ))}
        </div>
      )}
    </OpsShell>
  );
}
