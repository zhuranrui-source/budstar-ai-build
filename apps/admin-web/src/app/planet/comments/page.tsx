'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminPlanetCommentView } from '@budstar/contracts';
import {
  AdminApiClient,
  ApiRequestError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';
import { STATUS_LABELS } from '../labels';

/** 评论先发后审：这里处理被过滤拦下的评论，也可下架已展示的评论。 */
export default function PlanetCommentsPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [comments, setComments] = useState<AdminPlanetCommentView[]>([]);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setComments(await client.listPlanetComments(statusFilter || undefined));
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(cause instanceof ApiRequestError ? cause.message : '加载失败');
    }
  }, [client, statusFilter]);

  useEffect(() => {
    if (!client.readSession()) {
      window.location.replace('/login');
      return;
    }
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [client, load]);

  async function update(id: string, status: string) {
    setError('');
    try {
      await client.updatePlanetComment(id, status);
      await load();
    } catch (cause) {
      setError(cause instanceof ApiRequestError ? cause.message : '操作失败');
    }
  }

  return (
    <OpsShell active="planet-comments">
      <header className="ops-page-head">
        <div>
          <h1>评论管理</h1>
          <p>
            评论发出即显示；含敏感词、手机号、链接或联系方式的评论会被拦下，进入“待处理”。
          </p>
        </div>
      </header>
      {error && (
        <div className="ops-login-error" role="alert">
          {error}
        </div>
      )}
      <div className="planet-admin-filter">
        {[...Object.entries(STATUS_LABELS), ['', '全部']].map(
          ([value, label]) => (
            <button
              key={value}
              type="button"
              className={statusFilter === value ? 'is-active' : undefined}
              onClick={() => setStatusFilter(value)}
            >
              {label}
            </button>
          ),
        )}
      </div>
      {comments.length === 0 ? (
        <p className="ops-login-hint">暂无评论。</p>
      ) : (
        <div className="planet-admin-list">
          {comments.map((comment) => (
            <article key={comment.id} className="planet-admin-item is-comment">
              <div>
                <b>{comment.body}</b>
                <small>
                  {comment.authorLabel} · 评论于《{comment.postTitle}》 ·{' '}
                  {new Date(comment.createdAt).toLocaleString('zh-CN')}
                </small>
                {comment.reviewReason && (
                  <small className="planet-admin-reason">
                    待处理原因：{comment.reviewReason}
                  </small>
                )}
              </div>
              <div className="planet-admin-actions">
                <span
                  className={`planet-status is-${comment.status.toLowerCase()}`}
                >
                  {STATUS_LABELS[comment.status]}
                </span>
                {comment.status !== 'PUBLISHED' && (
                  <button
                    type="button"
                    onClick={() => void update(comment.id, 'PUBLISHED')}
                  >
                    展示
                  </button>
                )}
                {comment.status !== 'REMOVED' && (
                  <button
                    type="button"
                    onClick={() => void update(comment.id, 'REMOVED')}
                  >
                    删除
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </OpsShell>
  );
}
