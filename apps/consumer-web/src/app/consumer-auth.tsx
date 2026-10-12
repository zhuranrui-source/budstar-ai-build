'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  ConsumerAuthError,
  logoutConsumer,
  requestParentOtp,
  switchConsumerIdentity,
  verifyParentOtp,
} from './auth-client';
import {
  landingPathForIdentity,
  needsIdentityChoice,
  resolveLandingIdentity,
} from './auth-landing';
import {
  clearConsumerRole,
  readConsumerSession,
  readLastIdentity,
  resolveActiveRole,
  writeConsumerRole,
  writeConsumerSession,
  writeLastIdentity,
  type ConsumerRole,
} from './auth-session';

type AuthTab = 'phone' | 'student';
type AuthStage = 'credentials' | 'role';

export const OPEN_CONSUMER_AUTH_EVENT = 'budstar:open-consumer-auth';

export type OpenConsumerAuthDetail = {
  tab?: AuthTab;
  notice?: string;
  next?: string;
};

export function requestConsumerAuth(detail: OpenConsumerAuthDetail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenConsumerAuthDetail>(OPEN_CONSUMER_AUTH_EVENT, {
      detail,
    }),
  );
}

/** 未登录则弹出登录并提示；已登录则进入星球。 */
export function enterPlanetOrRequestAuth(navigate: (href: string) => void) {
  if (resolveActiveRole()) {
    navigate('/planet');
    return;
  }
  requestConsumerAuth({
    notice: '进入星芽星球前，请先登录或注册。',
    next: '/planet',
  });
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function ConsumerAccountTrigger({
  onOpenMenu,
  expanded,
}: {
  onOpenMenu: () => void;
  expanded: boolean;
}) {
  return (
    <button
      className="toon-account-trigger"
      type="button"
      aria-label="打开个人菜单"
      aria-expanded={expanded}
      onClick={onOpenMenu}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/demo-assets/avatar-placeholder.svg" alt="用户头像" />
    </button>
  );
}

export function ConsumerAuthChrome({
  variant = 'toon',
}: {
  variant?: 'toon' | 'community';
}) {
  const router = useRouter();
  const titleId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [stage, setStage] = useState<AuthStage>('credentials');
  const [phone, setPhone] = useState('13800138000');
  const [otp, setOtp] = useState('000000');
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pendingNextRef = useRef<string | null>(null);
  const [role, setRole] = useState<ConsumerRole | null>(null);
  const [displayName, setDisplayName] = useState('尚未登录');

  const refreshAccount = useCallback(() => {
    const active = resolveActiveRole();
    setRole(active);
    const session = readConsumerSession();
    if (active === 'parent') {
      setDisplayName(session?.actor.displayName ?? '家长用户');
    } else if (active === 'student') {
      setDisplayName(
        session?.actor.displayName === '家长用户'
          ? '学生用户'
          : (session?.actor.displayName ?? '学生用户'),
      );
    } else {
      setDisplayName('尚未登录');
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      refreshAccount();
    })();
  }, [refreshAccount]);

  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = window.setTimeout(
      () => setCodeCooldown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [codeCooldown]);

  useEffect(() => {
    if (!menuOpen && !authOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setAuthOpen(false);
        pendingNextRef.current = null;
        document.body.style.overflow = '';
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      const popover = document.querySelector('[data-account-popover]');
      const trigger = document.querySelector('[data-account-trigger-root]');
      if (
        menuOpen &&
        popover &&
        !popover.contains(target) &&
        trigger &&
        !trigger.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen, authOpen]);

  const openAuth = (options?: { notice?: string; next?: string }) => {
    setMenuOpen(false);
    setStage('credentials');
    setError('');
    setNotice(options?.notice ?? '');
    pendingNextRef.current = options?.next ?? null;
    setAuthOpen(true);
    document.body.style.overflow = 'hidden';
  };

  useEffect(() => {
    const onOpenRequest = (event: Event) => {
      const detail =
        (event as CustomEvent<OpenConsumerAuthDetail>).detail ?? {};
      openAuth({
        notice: detail.notice,
        next: detail.next,
      });
    };
    window.addEventListener(OPEN_CONSUMER_AUTH_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener(OPEN_CONSUMER_AUTH_EVENT, onOpenRequest);
    };
  }, []);

  const closeAuth = () => {
    setAuthOpen(false);
    setStage('credentials');
    setError('');
    setNotice('');
    pendingNextRef.current = null;
    document.body.style.overflow = '';
  };

  const finishWithIdentity = async (
    identity: ConsumerRole,
    options?: { switched?: boolean },
  ) => {
    let session = readConsumerSession();
    if (!session) {
      setError('请先完成登录');
      return;
    }
    const available = session.availableIdentities ?? [];
    const alreadyActive =
      session.activeIdentity === identity && available.includes(identity);
    if (options?.switched || !alreadyActive) {
      session = await switchConsumerIdentity(identity);
    } else {
      writeConsumerRole(identity);
      writeLastIdentity(identity);
      writeConsumerSession({ ...session, activeIdentity: identity });
    }
    refreshAccount();
    window.dispatchEvent(new Event('budstar:consumer-session-changed'));
    const next = pendingNextRef.current;
    closeAuth();
    router.push(next ?? landingPathForIdentity(identity));
  };

  const completeLogin = async (forceIdentity?: ConsumerRole | null) => {
    const session = readConsumerSession();
    if (!session) {
      setError('登录失败，请重试');
      return;
    }
    const lastIdentity = readLastIdentity();
    if (
      needsIdentityChoice({
        session,
        lastIdentity,
        forceIdentity,
      })
    ) {
      setStage('role');
      refreshAccount();
      return;
    }
    const identity = resolveLandingIdentity({
      session,
      lastIdentity,
      forceIdentity,
    });
    await finishWithIdentity(identity);
  };

  const sendCode = async () => {
    setError('');
    setNotice('');
    const normalized = normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized)) {
      setError('请输入有效的 11 位手机号');
      return;
    }
    setLoading(true);
    try {
      await requestParentOtp(normalized);
      setPhone(normalized);
      setCodeCooldown(60);
      setNotice('验证码已发送（本地固定码见测试账号说明）');
    } catch (cause) {
      setError(
        cause instanceof ConsumerAuthError ? cause.message : '验证码发送失败',
      );
    } finally {
      setLoading(false);
    }
  };

  const submitPhone = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const normalized = normalizePhone(phone);
    if (!/^1\d{10}$/.test(normalized) || !/^\d{6}$/.test(otp)) {
      setError('请填写正确的手机号和 6 位验证码');
      return;
    }
    setLoading(true);
    try {
      await verifyParentOtp(normalized, otp);
      await completeLogin(null);
    } catch (cause) {
      setError(
        cause instanceof ConsumerAuthError ? cause.message : '登录失败，请重试',
      );
    } finally {
      setLoading(false);
    }
  };

  const enterAs = async (nextRole: ConsumerRole) => {
    setLoading(true);
    setError('');
    try {
      await finishWithIdentity(nextRole, { switched: true });
    } catch (cause) {
      setError(
        cause instanceof ConsumerAuthError
          ? cause.message
          : '切换身份失败，请重试',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutConsumer();
    clearConsumerRole();
    refreshAccount();
    setMenuOpen(false);
  };

  const loggedIn = role !== null;
  const roleLabel =
    role === 'student'
      ? '学生身份'
      : role === 'parent'
        ? '家长身份'
        : '登录后进入星芽星球';

  return (
    <>
      <span data-account-trigger-root>
        {variant === 'toon' ? (
          <ConsumerAccountTrigger
            expanded={menuOpen}
            onOpenMenu={() => setMenuOpen((open) => !open)}
          />
        ) : (
          <button
            className="community-avatar"
            type="button"
            aria-label="打开个人菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/demo-assets/avatar-placeholder.svg" alt="" />
          </button>
        )}
      </span>

      <aside
        className="account-popover"
        data-account-popover
        hidden={!menuOpen}
      >
        <header>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/demo-assets/avatar-placeholder.svg" alt="用户头像" />
          <div>
            <b>{displayName}</b>
            <small>{roleLabel}</small>
          </div>
        </header>
        {!loggedIn && (
          <button
            className="account-primary-action"
            type="button"
            onClick={() => openAuth()}
          >
            登录或注册
          </button>
        )}
        {loggedIn && (
          <>
            <Link
              className="account-enter"
              href={landingPathForIdentity(role)}
              onClick={() => setMenuOpen(false)}
            >
              <span>
                <b>进入家庭门户</b>
                <small>课节、作品、动态和成长反馈</small>
              </span>
              <strong>→</strong>
            </Link>
            <button
              className="account-logout"
              type="button"
              onClick={() => void handleLogout()}
            >
              退出登录
            </button>
          </>
        )}
        <button
          className="account-help"
          type="button"
          onClick={() => {
            openAuth({
              notice: '如需帮助，请联系课程顾问或校区老师。',
            });
          }}
        >
          帮助与反馈 <span>←</span>
        </button>
      </aside>

      <div
        className="consumer-auth"
        hidden={!authOpen}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeAuth();
        }}
      >
        <section
          className="consumer-auth-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            className="consumer-auth-close"
            type="button"
            aria-label="关闭登录弹窗"
            onClick={closeAuth}
          >
            关闭
          </button>

          {stage === 'credentials' ? (
            <div>
              <span className="consumer-auth-kicker">星芽账号</span>
              <h2 id={titleId}>登录或注册</h2>
              {notice ? (
                <p role="status" style={{ color: '#9b402a', fontWeight: 650 }}>
                  {notice}
                </p>
              ) : null}
              <p>
                默认用手机号登录，家长与学生共用家庭视图（ADR-0007）；学生以档案方式在视图内切换。
              </p>
              {
                <form
                  className="consumer-auth-panel is-active"
                  onSubmit={(event) => void submitPhone(event)}
                >
                  <label>
                    手机号
                    <input
                      type="tel"
                      value={phone}
                      autoComplete="tel"
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                  <label>
                    验证码
                    <span className="consumer-code-input">
                      <input
                        value={otp}
                        inputMode="numeric"
                        maxLength={6}
                        onChange={(event) =>
                          setOtp(
                            event.target.value.replace(/\D/g, '').slice(0, 6),
                          )
                        }
                      />
                      <button
                        type="button"
                        disabled={loading || codeCooldown > 0}
                        onClick={() => void sendCode()}
                      >
                        {codeCooldown > 0 ? `${codeCooldown}s` : '获取验证码'}
                      </button>
                    </span>
                  </label>
                  {error && (
                    <p
                      role="alert"
                      style={{
                        margin: 0,
                        color: '#9b402a',
                        fontSize: 12,
                      }}
                    >
                      {error}
                    </p>
                  )}
                  <button
                    className="consumer-auth-primary"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? '验证中…' : '继续'}
                  </button>
                </form>
              }
              <div className="consumer-auth-divider">
                <span>或使用</span>
              </div>
              <div className="consumer-social-login">
                <button
                  type="button"
                  onClick={() =>
                    setNotice('微信登录尚未接入，请先使用手机号登录。')
                  }
                >
                  <span>微</span>微信登录
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNotice('企业微信登录尚未接入，请先使用手机号登录。')
                  }
                >
                  <span>企</span>企业微信登录
                </button>
              </div>
              <small>首次手机号登录将自动创建账号，默认进入家长身份。</small>
            </div>
          ) : (
            <div className="consumer-role-choice">
              <span className="consumer-auth-kicker">选择身份</span>
              <h2>这次以谁的身份进入？</h2>
              <p>之后可在账号菜单中切换，系统会记住你的选择。</p>
              {error && (
                <p role="alert" style={{ color: '#9b402a', fontSize: 12 }}>
                  {error}
                </p>
              )}
              <div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void enterAs('parent')}
                >
                  <b>我是家长</b>
                  <span>动态、作品和成长反馈</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
