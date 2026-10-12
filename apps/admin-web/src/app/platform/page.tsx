'use client';

import { FormEvent, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../auth-client';
import { OpsShell } from '../ops-shell';

const ENTITIES = [
  'campus',
  'appointment_lead',
  'teaching_class',
  'work_submission',
  'formal_feedback',
  'growth_report',
  'community_post',
] as const;

export default function PlatformDataBrowserPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [entity, setEntity] =
    useState<(typeof ENTITIES)[number]>('appointment_lead');
  const [campusId, setCampusId] = useState('');
  const [result, setResult] = useState<{
    fields: string[];
    rows: Array<Record<string, unknown>>;
    truncated: boolean;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function browse(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const session = client.readSession();
      if (!session || session.actor.kind !== 'platform-admin') {
        window.location.replace('/login');
        return;
      }
      const params = new URLSearchParams({ entity, limit: '20' });
      if (campusId) params.set('campusId', campusId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'}/platform/data-browser?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new ApiRequestError(
          response.status,
          'PLATFORM_BROWSER',
          '数据浏览器请求失败',
        );
      }
      const payload = (await response.json()) as {
        fields: string[];
        rows: Array<Record<string, unknown>>;
        truncated: boolean;
      };
      setResult(payload);
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(
        cause instanceof ForbiddenError
          ? '仅平台管理员可访问脱敏数据浏览器'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <OpsShell
      active="platform"
      displayName="平台管理员"
      roleLabel="平台治理"
      isPlatformAdmin
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>平台治理</p>
            <h1>脱敏数据浏览器</h1>
          </div>
        </header>
        <p>仅白名单实体与字段；禁止任意 SQL。</p>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        <form className="ops-form" onSubmit={browse}>
          <label>
            实体
            <select
              value={entity}
              onChange={(event) =>
                setEntity(event.target.value as (typeof ENTITIES)[number])
              }
            >
              {ENTITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            校区 ID（可选）
            <input
              value={campusId}
              onChange={(event) => setCampusId(event.target.value)}
            />
          </label>
          <button className="ops-primary" disabled={loading}>
            查询
          </button>
        </form>
        {result && (
          <section>
            <p>
              字段：{result.fields.join(', ')}
              {result.truncated ? '（结果已截断）' : ''}
            </p>
            <pre>{JSON.stringify(result.rows, null, 2)}</pre>
          </section>
        )}
      </>
    </OpsShell>
  );
}
