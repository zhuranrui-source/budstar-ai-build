'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { ConsumerAuthChrome } from './consumer-auth';
import { resolveActiveRole, type ConsumerRole } from './auth-session';

export type CommunityTab = 'planet' | 'family' | 'learning' | 'growth';

const ALL_TABS: Array<{
  id: CommunityTab;
  href: string;
  label: string;
  roles: ConsumerRole[];
}> = [
  {
    id: 'planet',
    href: '/planet',
    label: '星球',
    roles: ['parent', 'student'],
  },
  { id: 'family', href: '/family', label: '孩子', roles: ['parent'] },
  { id: 'learning', href: '/learning', label: '学习', roles: ['student'] },
  { id: 'growth', href: '/growth', label: '成长', roles: ['student'] },
];

export function CommunityShell({
  active,
  children,
  subtitle,
}: {
  active: CommunityTab;
  children: ReactNode;
  subtitle?: string;
}) {
  const [role, setRole] = useState<ConsumerRole | null>(null);

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = 'community-body';
    const syncRole = () => setRole(resolveActiveRole());
    syncRole();
    window.addEventListener('focus', syncRole);
    window.addEventListener('budstar:consumer-session-changed', syncRole);
    return () => {
      document.body.className = previous;
      window.removeEventListener('focus', syncRole);
      window.removeEventListener('budstar:consumer-session-changed', syncRole);
    };
  }, []);

  const tabs = ALL_TABS.filter((tab) =>
    role ? tab.roles.includes(role) : true,
  );
  const resolvedSubtitle =
    subtitle ??
    (role === 'student'
      ? '学生学习'
      : role === 'parent'
        ? '家庭门户'
        : '星芽星球');

  return (
    <div className="community-body">
      <header className="community-header">
        <div className="community-brand-group">
          <Link className="community-brand" href="/planet">
            <span className="community-brand-mark">芽</span>
            <span>
              <b>星芽星球</b>
              {resolvedSubtitle ? <small>{resolvedSubtitle}</small> : null}
            </span>
          </Link>
        </div>
        <nav className="community-nav" aria-label="星芽星球导航">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={tab.id === active ? 'is-active' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="community-account">
          <Link className="community-back-home" href="/">
            ← 返回首页
          </Link>
          <ConsumerAuthChrome variant="community" />
        </div>
      </header>
      <main className="community-main">{children}</main>
    </div>
  );
}
