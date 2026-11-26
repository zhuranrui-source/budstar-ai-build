'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { AdminApiClient } from './auth-client';

export type OpsNavKey =
  | 'desk'
  | 'planet'
  | 'planet-comments'
  | 'subject-courses'
  | 'platform-leads'
  | 'consumer-accounts';

type NavItem = { key: OpsNavKey; href: string; label: string };

const STAFF_NAV: NavItem[] = [
  { key: 'desk', href: '/', label: '工作台' },
  { key: 'planet', href: '/planet', label: '星球内容' },
  { key: 'planet-comments', href: '/planet/comments', label: '评论管理' },
];

const PLATFORM_NAV: NavItem[] = [
  ...STAFF_NAV,
  {
    key: 'subject-courses',
    href: '/platform/subject-courses',
    label: '学科内容库',
  },
  { key: 'platform-leads', href: '/platform/leads', label: '线索 CRM' },
  {
    key: 'consumer-accounts',
    href: '/platform/consumer-accounts',
    label: '客户账号',
  },
];

function apiClient() {
  return new AdminApiClient(
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
  );
}

export function OpsShell({
  active,
  displayName,
  roleLabel,
  isPlatformAdmin,
  onLogout,
  children,
  primaryAction,
}: {
  active: OpsNavKey;
  displayName?: string;
  roleLabel?: string;
  /** 不传时按当前登录会话自动判断。 */
  isPlatformAdmin?: boolean;
  onLogout?: () => void;
  children: ReactNode;
  primaryAction?: ReactNode;
}) {
  const [sessionInfo, setSessionInfo] = useState<{
    isPlatformAdmin: boolean;
    displayName: string;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      const session = apiClient().readSession();
      if (session) {
        setSessionInfo({
          isPlatformAdmin: session.actor.kind === 'platform-admin',
          displayName: session.actor.displayName,
        });
      }
    })();
  }, []);

  const platform = isPlatformAdmin ?? sessionInfo?.isPlatformAdmin ?? false;
  const nav = platform ? PLATFORM_NAV : STAFF_NAV;
  const name = displayName ?? sessionInfo?.displayName ?? '';
  const role = roleLabel ?? (platform ? '平台管理员' : '员工');
  const logout =
    onLogout ??
    (() => {
      void apiClient()
        .logout()
        .finally(() => window.location.replace('/login'));
    });

  return (
    <div className="ops-body">
      <header className="ops-header">
        <Link className="ops-brand" href="/">
          <span className="ops-brand-mark">芽</span>
          <span>
            <b>星芽AI</b>
            <small>机构后台</small>
          </span>
        </Link>
        <nav className="ops-primary-nav" aria-label="后台主导航">
          {nav.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={item.key === active ? 'is-active' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ops-user">
          <a
            href="https://budstar-ai.site/planet"
            target="_blank"
            rel="noreferrer"
          >
            星芽星球
          </a>
          <button type="button" onClick={logout} title="退出登录">
            <span>{name}</span>
            <small>{role}</small>
          </button>
        </div>
      </header>
      <main className="ops-main">
        <section className="ops-panel is-active">
          {primaryAction}
          {children}
        </section>
      </main>
    </div>
  );
}
