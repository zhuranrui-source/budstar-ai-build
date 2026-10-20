#!/usr/bin/env node
/**
 * 客户线索每日摘要（推送到飞书「客户线索机器人」群）
 *
 * 用法：node scripts/daily-lead-digest.mjs [--api http://localhost:3001/api]
 *
 * 内容：昨日新增线索、当前逾期未跟进、漏斗概览
 * 定时：由 LaunchAgent（~/Library/LaunchAgents/com.budstar.leads.digest.plist）每日 09:00 触发
 */
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const API =
  args[args.indexOf('--api') + 1] ??
  process.env.BUDSTAR_API_URL ??
  'http://localhost:3001/api';
const CHAT_ID =
  process.env.LEAD_BOT_CHAT_ID ?? 'oc_facdf9e7e41853fa90e2061862bcae06';

async function platformToken() {
  const login = await fetch(`${API}/auth/platform/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginIdentifier: 'platform@local',
      password: 'Platform123!',
    }),
  }).then((r) => r.json());
  const session = await fetch(`${API}/auth/platform/verify-second-factor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: login.challengeToken,
      code: '000000',
    }),
  }).then((r) => r.json());
  return session.accessToken;
}

async function main() {
  const token = await platformToken();
  const headers = { Authorization: `Bearer ${token}` };

  const [leads, funnel] = await Promise.all([
    fetch(`${API}/admin/appointment-leads`, {
      headers: { ...headers, 'X-Campus-Id': 'shenzhen-nanshan' },
    }).then((r) => r.json()),
    fetch(`${API}/admin/appointment-leads/funnel`, {
      headers: { ...headers, 'X-Campus-Id': 'shenzhen-nanshan' },
    }).then((r) => r.json()),
  ]);

  const now = new Date();
  const yesterdayStart = new Date(now.getTime() - 24 * 3600_000);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterdayStart.getTime() + 24 * 3600_000);

  const newYesterday = leads.filter((lead) => {
    const created = new Date(lead.createdAt);
    return created >= yesterdayStart && created < yesterdayEnd;
  });
  const overdue = leads.filter(
    (lead) =>
      lead.nextContactAt &&
      new Date(lead.nextContactAt) <= now &&
      lead.status !== 'ENROLLED' &&
      lead.status !== 'CLOSED',
  );

  const STATUS_CN = {
    PENDING_CONTACT: '待联系',
    CONTACTED: '已联系',
    APPOINTMENT_SCHEDULED: '已预约',
    VISITED: '已到访',
    ENROLLED: '已报名',
  };

  const lines = [
    '📊 客户线索日报',
    `日期：${now.toLocaleDateString('zh-CN')}`,
    '',
    `🆕 昨日新增：${newYesterday.length} 条`,
    ...newYesterday
      .slice(0, 10)
      .map(
        (lead) =>
          `  • ${lead.parentName}（${lead.childAgeOrGrade}·${lead.interestedCourse}）${lead.phoneMasked}`,
      ),
    '',
    `⚠️ 逾期未跟进：${overdue.length} 条`,
    ...overdue
      .slice(0, 10)
      .map(
        (lead) =>
          `  • ${lead.parentName}（应于 ${new Date(lead.nextContactAt).toLocaleString('zh-CN')} 跟进）`,
      ),
    '',
    '📈 漏斗概览：',
    ...funnel.stages.map(
      (stage) =>
        `  ${STATUS_CN[stage.status] ?? stage.status}：${stage.count}${stage.overdue > 0 ? `（逾期 ${stage.overdue}）` : ''}`,
    ),
  ];

  const text = lines.join('\n');
  console.log(text);

  execSync(
    `lark-cli im +messages-send --chat-id ${CHAT_ID} --text ${JSON.stringify(text)} --as bot`,
    { stdio: 'inherit' },
  );
}

main().catch((cause) => {
  console.error('日报失败：', cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
