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

function isPlatformAdminSession(session: { actor: { kind: string } }): boolean {
  return session.actor.kind === 'platform-admin';
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
  const [overview, setOverview] = useState<{
    modules: string[];
    roles?: string[];
  } | null>(null);
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
            setOverview(await client.getCampusOverview(storedCampus));
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
    if (nextSession.actor.kind === 'platform-admin') {
      setOverview(await client.getPlatformOverview());
    }
    if (loginOnly && nextSession.actor.kind === 'platform-admin') {
      window.location.replace('/platform');
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
      setOverview(await client.getCampusOverview(campusId));
    });
    void loadTodoStream(campusId);
  }

  // ADR-0010 移动待办流：手机优先的真实聚合（提交/审核/线索），
  // 桌面端同样展示；身份空间差异化（教师=校区队列，平台=CRM 线索）。
  const [todo, setTodo] = useState<{
    loaded: boolean;
    submissions: Array<{
      id: string;
      lessonTitle: string;
      studentDisplayName: string;
      status: string;
    }>;
    moderation: Array<{ id: string; title: string; riskLevel: string }>;
    leads: Array<{ id: string; parentName: string; status: string }>;
  }>({ loaded: false, submissions: [], moderation: [], leads: [] });

  async function loadTodoStream(campusId?: string) {
    const campus = campusId ?? selectedCampus;
    if (!campus) return;
    try {
      if (session && isPlatformAdminSession(session)) {
        const leads = await client.listAppointmentLeads(campus, {
          status: 'PENDING_CONTACT',
        });
        setTodo({ loaded: true, submissions: [], moderation: [], leads });
      } else {
        const [submissions, moderation] = await Promise.all([
          client.listSubmissions(campus, { status: 'SUBMITTED' }),
          client.listModerationQueue(campus),
        ]);
        setTodo({
          loaded: true,
          submissions,
          moderation: moderation.filter(
            (item) => item.status === 'PENDING_REVIEW',
          ),
          leads: [],
        });
      }
    } catch {
      setTodo((current) => ({ ...current, loaded: true }));
    }
  }

  useEffect(() => {
    if (selectedCampus) void loadTodoStream();
  }, [selectedCampus]);

  async function logout() {
    await client.logout();
    window.sessionStorage.removeItem('budstar.admin.campus');
    setSession(null);
    setOverview(null);
    setSelectedCampus('');
    window.location.replace('/login');
  }

  async function recoverFromForbidden() {
    setForbidden(false);
    setOverview(null);
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
          <p>
            {isPlatformAdmin
              ? '平台治理空间'
              : `下午好，${session.actor.displayName}`}
          </p>
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

      {!isPlatformAdmin && !selectedCampus ? (
        <>
          <div className="ops-page-head">
            <div>
              <h1>选择校区</h1>
              <p>选择后，服务端仍会按账号成员关系和组合角色逐次校验。</p>
            </div>
          </div>
          <div className="ops-class-list">
            {session.campuses.map((campus) => (
              <button
                key={campus.id}
                type="button"
                disabled={loading}
                onClick={() => void chooseCampus(campus.id)}
              >
                <span className="ops-class-cover">
                  {campus.name.slice(0, 1)}
                </span>
                <span>
                  <b>{campus.name}</b>
                  <small>{campus.roles.join(' · ')}</small>
                </span>
                <em>进入</em>
                <strong>选择</strong>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="ops-summary" aria-label="今日概览">
            {(isPlatformAdmin
              ? [
                  [
                    '治理模块',
                    String(overview?.modules.length ?? '—'),
                    '平台能力',
                  ],
                  ['校区业务', '—', '平台身份不可访问'],
                  ['审计', '开', '关键操作留痕'],
                  ['状态', loading ? '同步中' : '平稳', '实时会话'],
                ]
              : [
                  ['待处理事项', '8', '数据来自实时 API'],
                  ['本周课程', '12', overview?.roles?.join('、') ?? '加载中'],
                  ['需要关注', '3', currentCampus?.name ?? ''],
                  ['模块', String(overview?.modules.length ?? 0), '已授权'],
                ]
            ).map(([label, value, note]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>

          <div className="ops-dashboard">
            <section className="ops-task-board">
              <header>
                <div>
                  <h2>今日待办</h2>
                  <p>按紧急程度排序</p>
                </div>
              </header>
              <div className="ops-task-list">
                {(isPlatformAdmin
                  ? [
                      ['治理', '查看脱敏数据浏览器', '平台治理', '/platform'],
                      [
                        '课程',
                        '课程版本治理',
                        '仅平台身份',
                        '/platform/subject-courses',
                      ],
                      [
                        '线索',
                        `待联系线索 ${todo.leads.length} 条`,
                        'CRM 跟进',
                        '/platform/leads',
                      ],
                    ]
                  : [
                      [
                        '提交',
                        `待点评作品 ${todo.submissions.length} 份`,
                        '教学队列',
                        '/teacher/submissions',
                      ],
                      [
                        '审核',
                        `社区待审核 ${todo.moderation.length} 条`,
                        '风险控制',
                        '/teacher/moderation',
                      ],
                      ['点评', '发布正式点评', '人工闭环', '/teacher/feedback'],
                      ['绑定', '处理家庭绑定', '家长服务', '/teacher/family'],
                    ]
                ).map(([priority, title, meta, href]) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => {
                      window.location.href = href;
                    }}
                  >
                    <span
                      className={`ops-task-priority${
                        priority === '今天'
                          ? ' is-high'
                          : priority === '家长'
                            ? ' is-warn'
                            : ''
                      }`}
                    >
                      {priority}
                    </span>
                    <span>
                      <b>{title}</b>
                      <small>{meta}</small>
                    </span>
                    <strong>去处理</strong>
                  </button>
                ))}
              </div>
            </section>
            <aside className="ops-day-panel">
              <h2>今日概览</h2>
              <article>
                <time>身份</time>
                <div>
                  <b>{session.actor.displayName}</b>
                  <small>{roleLabel}</small>
                </div>
              </article>
              <article>
                <time>范围</time>
                <div>
                  <b>{isPlatformAdmin ? '平台治理' : '校区运营'}</b>
                  <small>
                    {(overview?.modules ?? []).slice(0, 3).join(' · ') ||
                      '加载模块中'}
                  </small>
                </div>
              </article>
            </aside>
          </div>
        </>
      )}
    </OpsShell>
  );
}
