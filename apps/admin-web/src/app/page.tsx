'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AuthenticatedSession,
  AuthenticationChallenge,
} from '@budstar/contracts';
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

const LOCAL_ADMIN_ACCOUNTS = {
  staff: {
    loginIdentifier: 'staff@local',
    password: 'Password123!',
    secondFactorCode: '000000',
    hint: '员工：staff@local / Password123!，二次验证码 000000',
  },
  platform: {
    loginIdentifier: 'platform@local',
    password: 'Platform123!',
    secondFactorCode: '000000',
    hint: '平台：platform@local / Platform123!，二次验证码 000000',
  },
  partner: {
    loginIdentifier: 'partner@local',
    password: 'Partner123!',
    secondFactorCode: '000000',
    hint: '合作方：partner@local / Partner123!，二次验证码 000000',
  },
} as const;

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
  const [challenge, setChallenge] = useState<AuthenticationChallenge | null>(
    null,
  );
  const [entry, setEntry] = useState<'staff' | 'partner' | 'platform'>('staff');
  const [loginIdentifier, setLoginIdentifier] = useState<string>(
    LOCAL_ADMIN_ACCOUNTS.staff.loginIdentifier,
  );
  const [password, setPassword] = useState<string>(
    LOCAL_ADMIN_ACCOUNTS.staff.password,
  );
  const [secondFactorCode, setSecondFactorCode] = useState<string>(
    LOCAL_ADMIN_ACCOUNTS.staff.secondFactorCode,
  );
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
        setChallenge(null);
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

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      setChallenge(await client.login(entry, loginIdentifier, password));
    });
  }

  async function submitSecondFactor(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    await run(async () => {
      const nextSession = await client.verifySecondFactor(
        entry,
        challenge.challengeToken,
        secondFactorCode,
      );
      setSession(nextSession);
      setChallenge(null);
      if (nextSession.actor.kind === 'platform-admin') {
        setOverview(await client.getPlatformOverview());
      }
      // ADR-0010：按身份空间落位——合作方 → /partner，平台 → /platform
      if (nextSession.actor.kind === 'partner') {
        window.location.replace('/partner');
        return;
      }
      if (loginOnly && nextSession.actor.kind === 'platform-admin') {
        window.location.replace('/platform');
        return;
      }
      if (loginOnly) window.location.replace('/');
    });
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

  function switchEntry(nextEntry: 'staff' | 'partner' | 'platform') {
    const account = LOCAL_ADMIN_ACCOUNTS[nextEntry];
    setEntry(nextEntry);
    setChallenge(null);
    setError('');
    setLoginIdentifier(account.loginIdentifier);
    setPassword(account.password);
    setSecondFactorCode(account.secondFactorCode);
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
    const isSecondFactor = challenge !== null;
    return (
      <main className="ops-login">
        <section className="ops-login-card">
          <span className="ops-kicker">
            {isSecondFactor ? '安全验证' : 'BUDSTAR AI · 机构工作台'}
          </span>
          <h1>{isSecondFactor ? '输入二次验证码' : '登录机构后台'}</h1>
          <p>
            {isSecondFactor
              ? '完成本地二次验证后进入校区运营空间。'
              : '安全连接课程交付、家庭沟通与成长报告。'}
          </p>
          {!isSecondFactor && (
            <div className="ops-entry-tabs">
              <button
                className={entry === 'staff' ? 'is-active' : undefined}
                onClick={() => switchEntry('staff')}
                type="button"
              >
                员工入口
              </button>
              <button
                className={entry === 'partner' ? 'is-active' : undefined}
                type="button"
                onClick={() => switchEntry('partner')}
              >
                合作方
              </button>
              <button
                className={entry === 'platform' ? 'is-active' : undefined}
                onClick={() => switchEntry('platform')}
                type="button"
              >
                平台管理员
              </button>
            </div>
          )}
          <form
            onSubmit={isSecondFactor ? submitSecondFactor : submitLogin}
            className="ops-login-form"
          >
            {isSecondFactor ? (
              <label>
                二次验证码
                <input
                  value={secondFactorCode}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setSecondFactorCode(event.target.value)}
                  autoFocus
                />
              </label>
            ) : (
              <>
                <label>
                  账号
                  <input
                    value={loginIdentifier}
                    onChange={(event) => setLoginIdentifier(event.target.value)}
                    autoComplete="username"
                  />
                </label>
                <label>
                  密码
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </label>
              </>
            )}
            <p className="ops-login-hint" role="note">
              {isSecondFactor
                ? `本地二次验证码：${LOCAL_ADMIN_ACCOUNTS[entry].secondFactorCode}`
                : LOCAL_ADMIN_ACCOUNTS[entry].hint}
            </p>
            {error && (
              <div className="ops-login-error" role="alert">
                {error}
              </div>
            )}
            <button className="ops-primary" disabled={loading}>
              {loading ? '正在验证…' : isSecondFactor ? '完成验证' : '继续'}
            </button>
            {isSecondFactor && (
              <button
                type="button"
                className="ops-text-button"
                onClick={() => {
                  setChallenge(null);
                  setSecondFactorCode(
                    LOCAL_ADMIN_ACCOUNTS[entry].secondFactorCode,
                  );
                  setError('');
                }}
              >
                返回账号登录
              </button>
            )}
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
