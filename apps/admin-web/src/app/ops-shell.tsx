'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type OpsNavKey =
  | 'desk'
  | 'classes'
  | 'submissions'
  | 'feedback'
  | 'moderation'
  | 'family'
  | 'leads'
  | 'platform'
  | 'subject-courses'
  | 'platform-leads';

const STAFF_NAV: Array<{ key: OpsNavKey; href: string; label: string }> = [
  { key: 'desk', href: '/', label: '工作台' },
  { key: 'classes', href: '/teacher/classes', label: '班级' },
  { key: 'submissions', href: '/teacher/submissions', label: '提交' },
  { key: 'feedback', href: '/teacher/feedback', label: '点评' },
  { key: 'moderation', href: '/teacher/moderation', label: '审核' },
  { key: 'family', href: '/teacher/family', label: '家庭' },
];

export function OpsShell({
  active,
  displayName,
  roleLabel,
  isPlatformAdmin = false,
  onLogout,
  children,
  primaryAction,
}: {
  active: OpsNavKey;
  displayName: string;
  roleLabel: string;
  isPlatformAdmin?: boolean;
  onLogout?: () => void;
  children: ReactNode;
  primaryAction?: ReactNode;
}) {
  const nav = isPlatformAdmin
    ? [
        { key: 'desk' as const, href: '/', label: '工作台' },
        { key: 'platform' as const, href: '/platform', label: '数据浏览器' },
        {
          key: 'subject-courses' as const,
          href: '/platform/subject-courses',
          label: '学科内容库',
        },
        {
          key: 'platform-leads' as const,
          href: '/platform/leads',
          label: '线索 CRM',
        },
      ]
    : STAFF_NAV;

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
            href="http://localhost:3000/planet"
            target="_blank"
            rel="noreferrer"
          >
            星芽星球
          </a>
          <button type="button" onClick={onLogout}>
            <span>{displayName}</span>
            <small>{roleLabel}</small>
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
