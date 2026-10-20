'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';

type LeadItem = {
  id: string;
  parentName: string;
  phoneMasked: string;
  childAgeOrGrade: string;
  interestedCourse: string;
  preferredContactTime: string;
  status: string;
  note: string | null;
  source: string | null;
  nextContactAt: string | null;
  createdAt: string;
};

type FunnelData = {
  stages: Array<{ status: string; count: number; overdue: number }>;
  conversionRates: Array<{ from: string; to: string; rate: number }>;
};

const SOURCE_OPTIONS = [
  ['OFFICIAL_SITE', '官网'],
  ['REFERRAL', '转介绍'],
  ['OFFLINE', '地推'],
  ['PARTNER', '合作方'],
  ['OTHER', '其他'],
] as const;

const SOURCE_LABELS: Record<string, string> =
  Object.fromEntries(SOURCE_OPTIONS);

type HistoryItem = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  note: string | null;
};

const CAMPUS_KEY = 'budstar.admin.campus';
const STATUS_OPTIONS = [
  'PENDING_CONTACT',
  'CONTACTED',
  'APPOINTMENT_SCHEDULED',
  'VISITED',
  'ENROLLED',
  'CLOSED',
] as const;

const NEXT_STATUS: Record<string, string[]> = {
  PENDING_CONTACT: ['CONTACTED', 'CLOSED'],
  CONTACTED: ['APPOINTMENT_SCHEDULED', 'CLOSED'],
  APPOINTMENT_SCHEDULED: ['VISITED', 'CLOSED'],
  VISITED: ['ENROLLED', 'CLOSED'],
  ENROLLED: [],
  CLOSED: ['PENDING_CONTACT', 'CONTACTED', 'APPOINTMENT_SCHEDULED', 'VISITED'],
};

export default function LeadsPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const campusId =
    typeof window === 'undefined'
      ? ''
      : (window.sessionStorage.getItem(CAMPUS_KEY) ?? '');
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [funnelRange, setFunnelRange] = useState('');
  const [trend, setTrend] = useState<Array<{ date: string; count: number }>>(
    [],
  );
  const [nextContactDate, setNextContactDate] = useState('');
  const [query, setQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [note, setNote] = useState('');
  const [toStatus, setToStatus] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      const session = client.readSession();
      if (!session) {
        window.location.replace('/login');
        return;
      }
      if (!campusId) {
        window.location.replace('/');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const days = funnelRange ? Number(funnelRange) : 0;
        const range = days
          ? {
              from: new Date(Date.now() - days * 24 * 3600_000).toISOString(),
            }
          : undefined;
        const [nextLeads, nextFunnel, nextTrend] = await Promise.all([
          client.listAppointmentLeads(campusId, {
            status: statusFilter || undefined,
            source: (sourceFilter || undefined) as
              | 'OFFICIAL_SITE'
              | 'REFERRAL'
              | 'OFFLINE'
              | 'PARTNER'
              | 'OTHER'
              | undefined,
            overdue: overdueOnly ? 'true' : undefined,
          }),
          client.getLeadFunnel(campusId, range),
          client.getLeadTrend(campusId, 14),
        ]);
        if (cancelled) return;
        setLeads(nextLeads);
        setFunnel(nextFunnel);
        setTrend(nextTrend);
        setBootstrapped(true);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setError(
          cause instanceof ForbiddenError
            ? '无权访问该校区线索'
            : cause instanceof ApiRequestError
              ? cause.message
              : '服务暂时不可用，请稍后重试',
        );
        setBootstrapped(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campusId, client, statusFilter, sourceFilter, overdueOnly, funnelRange]);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError('');
    try {
      await action();
    } catch (cause) {
      if (cause instanceof SessionExpiredError) {
        window.location.replace('/login');
        return;
      }
      setError(
        cause instanceof ForbiddenError
          ? '无权访问该校区线索'
          : cause instanceof ApiRequestError
            ? cause.message
            : '服务暂时不可用，请稍后重试',
      );
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setLeads(
      await client.listAppointmentLeads(campusId, {
        status: statusFilter || undefined,
        q: query || undefined,
      }),
    );
  }

  async function openLead(lead: LeadItem) {
    setSelectedLead(lead);
    setNote(lead.note ?? '');
    setToStatus(NEXT_STATUS[lead.status]?.[0] ?? '');
    setReopenReason('');
    await run(async () => {
      setHistory(await client.getAppointmentLeadHistory(campusId, lead.id));
    });
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedLead) return;
    await run(async () => {
      const updated = (await client.updateAppointmentLead(
        campusId,
        selectedLead.id,
        { note },
      )) as LeadItem;
      setSelectedLead(updated);
      await refresh();
    });
  }

  async function transition(event: FormEvent) {
    event.preventDefault();
    if (!selectedLead || !toStatus) return;
    await run(async () => {
      const updated = (await client.transitionAppointmentLead(
        campusId,
        selectedLead.id,
        {
          toStatus,
          note: note || undefined,
          reopenReason:
            selectedLead.status === 'CLOSED' ? reopenReason : undefined,
        },
      )) as LeadItem;
      setSelectedLead(updated);
      setHistory(await client.getAppointmentLeadHistory(campusId, updated.id));
      await refresh();
    });
  }

  if (!bootstrapped) {
    return (
      <main className="ops-redirect">
        <span>正在加载线索工作台…</span>
      </main>
    );
  }

  return (
    <OpsShell
      active="leads"
      displayName="老师"
      roleLabel="校区工作台"
      onLogout={() => window.location.replace('/login')}
    >
      <>
        <header className="ops-page-head">
          <div>
            <p>招生转化</p>
            <h1>线索工作台</h1>
          </div>
          <div className="ops-status">{campusId}</div>
        </header>
        {error && (
          <div className="ops-login-error" role="alert">
            {error}
          </div>
        )}
        <section>
          <form
            className="ops-form"
            onSubmit={(event) => {
              event.preventDefault();
              void run(refresh);
            }}
          >
            <label>
              状态筛选
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">全部</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              来源
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="">全部</option>
                {SOURCE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={overdueOnly}
                onChange={(event) => setOverdueOnly(event.target.checked)}
              />
              仅看逾期未跟进
            </label>
            <label>
              关键词
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="家长姓名或兴趣课程"
              />
            </label>
            <button className="ops-primary" disabled={loading}>
              筛选
            </button>
          </form>
        </section>
        {trend.length > 0 && (
          <section aria-label="近14天新增线索" style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px' }}>近 14 天新增线索趋势</p>
            <div
              style={{
                display: 'flex',
                gap: 3,
                alignItems: 'flex-end',
                height: 48,
              }}
            >
              {trend.map((day) => {
                const max = Math.max(...trend.map((item) => item.count), 1);
                return (
                  <div
                    key={day.date}
                    title={`${day.date}：${day.count} 条`}
                    style={{
                      flex: 1,
                      minWidth: 8,
                      height: Math.max(4, (day.count / max) * 48),
                      background: '#1f6f5c',
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>
          </section>
        )}
        {funnel && (
          <section aria-label="线索漏斗" style={{ marginBottom: 12 }}>
            <label style={{ marginBottom: 8, display: 'block' }}>
              漏斗时间段
              <select
                value={funnelRange}
                onChange={(event) => setFunnelRange(event.target.value)}
              >
                <option value="">全部</option>
                <option value="7">近 7 天</option>
                <option value="30">近 30 天</option>
                <option value="90">近 90 天</option>
              </select>
            </label>
          </section>
        )}
        {funnel && (
          <section className="ops-summary" aria-label="线索漏斗数据">
            {funnel.stages.map((stage) => (
              <article key={stage.status}>
                <span>{stage.status}</span>
                <strong>{stage.count}</strong>
                <small>
                  {stage.overdue > 0
                    ? `⚠ 逾期 ${stage.overdue} 条`
                    : funnel.conversionRates.find(
                          (rate) => rate.to === stage.status,
                        )?.rate !== undefined
                      ? `转化 ${
                          funnel.conversionRates.find(
                            (rate) => rate.to === stage.status,
                          )!.rate
                        }%`
                      : '—'}
                </small>
              </article>
            ))}
          </section>
        )}
        <section className="ops-class-list">
          {leads.map((lead) => (
            <article
              key={lead.id}
              style={
                lead.nextContactAt &&
                new Date(lead.nextContactAt) <= new Date() &&
                lead.status !== 'ENROLLED' &&
                lead.status !== 'CLOSED'
                  ? { borderLeft: '3px solid #c0392b' }
                  : undefined
              }
            >
              <span>
                {lead.status}
                {lead.source
                  ? ` · ${SOURCE_LABELS[lead.source] ?? lead.source}`
                  : ''}
                {lead.nextContactAt &&
                new Date(lead.nextContactAt) <= new Date() &&
                lead.status !== 'ENROLLED' &&
                lead.status !== 'CLOSED'
                  ? ' · ⚠逾期'
                  : ''}
              </span>
              <strong>{lead.parentName}</strong>
              <small>
                {lead.phoneMasked} · {lead.interestedCourse} ·{' '}
                {lead.childAgeOrGrade}
                {lead.nextContactAt
                  ? ` · 下次 ${new Date(lead.nextContactAt).toLocaleString('zh-CN')}`
                  : ''}
              </small>
              <button
                type="button"
                className="ops-text-button"
                onClick={() => void openLead(lead)}
              >
                打开详情
              </button>
            </article>
          ))}
        </section>
        {selectedLead && (
          <section style={{ marginTop: 24 }}>
            <div style={{ width: '100%' }}>
              <p>线索详情</p>
              <h2>
                {selectedLead.parentName} · {selectedLead.phoneMasked}
              </h2>
              <p>
                {selectedLead.preferredContactTime} ·{' '}
                {selectedLead.interestedCourse}
              </p>
              <form
                className="ops-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await client.updateAppointmentLead(
                      campusId,
                      selectedLead.id,
                      {
                        nextContactAt: nextContactDate
                          ? new Date(nextContactDate).toISOString()
                          : null,
                      },
                    );
                    await refresh();
                    await openLead(
                      (await client.listAppointmentLeads(campusId, {})).find(
                        (item) => item.id === selectedLead.id,
                      ) ?? selectedLead,
                    );
                  });
                }}
              >
                <label>
                  下一步跟进时间（ISSUE-09：无下一步动作的线索是死线索）
                  <input
                    type="datetime-local"
                    value={nextContactDate}
                    onChange={(event) => setNextContactDate(event.target.value)}
                  />
                </label>
                <button className="ops-primary" disabled={loading}>
                  设置跟进提醒
                </button>
              </form>
              <button
                type="button"
                className="ops-primary"
                disabled={loading}
                onClick={() =>
                  void run(async () => {
                    const { phone } = await client.getLeadPhone(
                      campusId,
                      selectedLead.id,
                    );
                    window.location.href = `tel:${phone}`;
                  })
                }
              >
                📞 拨打电话（号码不展示）
              </button>
              <form className="ops-form" onSubmit={saveNote}>
                <label>
                  备注
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                  />
                </label>
                <button className="ops-primary" disabled={loading}>
                  保存备注
                </button>
              </form>
              <form className="ops-form" onSubmit={transition}>
                <label>
                  流转到
                  <select
                    value={toStatus}
                    onChange={(event) => setToStatus(event.target.value)}
                  >
                    {(NEXT_STATUS[selectedLead.status] ?? []).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedLead.status === 'CLOSED' && (
                  <label>
                    重开原因
                    <input
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      required
                    />
                  </label>
                )}
                <button
                  className="ops-primary"
                  disabled={
                    loading || !(NEXT_STATUS[selectedLead.status] ?? []).length
                  }
                >
                  确认流转
                </button>
              </form>
              <div style={{ marginTop: 24 }}>
                <p>状态历史</p>
                <ul>
                  {history.map((item) => (
                    <li key={item.id}>
                      {item.fromStatus ?? '—'} → {item.toStatus} ·{' '}
                      {new Date(item.changedAt).toLocaleString('zh-CN')}
                      {item.note ? ` · ${item.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </>
    </OpsShell>
  );
}
