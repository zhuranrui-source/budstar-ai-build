'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { ConsumerAuthChrome } from './consumer-auth';

export type CommunityTab = 'planet' | 'favorites' | 'mine';

const TABS: Array<{ id: CommunityTab; href: string; label: string }> = [
  { id: 'planet', href: '/planet', label: '星球' },
  { id: 'favorites', href: '/planet?view=favorites', label: '我的收藏' },
  { id: 'mine', href: '/planet?view=mine', label: '我的分享' },
];

export function CommunityShell({
  active,
  children,
  onNavigate,
}: {
  active: CommunityTab;
  children: ReactNode;
  /** 同页切换（星球页内）时不整页刷新。 */
  onNavigate?: (tab: CommunityTab) => void;
}) {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = 'community-body';
    return () => {
      document.body.className = previous;
    };
  }, []);

  return (
    <div className="community-body">
      <header className="community-header">
        <div className="community-brand-group">
          <Link className="community-brand" href="/planet">
            <span className="community-brand-mark">芽</span>
            <span>
              <b>星芽星球</b>
              <small>作品 · 竞赛 · 星芽故事</small>
            </span>
          </Link>
        </div>
        <nav className="community-nav" aria-label="星芽星球导航">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={tab.id === active ? 'is-active' : undefined}
              onClick={(event) => {
                if (!onNavigate) return;
                event.preventDefault();
                onNavigate(tab.id);
              }}
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
