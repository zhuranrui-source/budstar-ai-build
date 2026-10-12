# BudStar AI Platform

青少年 AI 课程交付平台（家庭视图小程序 + admin H5），pnpm monorepo。业务领域语言见 `CONTEXT.md`，架构决策见 `docs/adr/`。

## Agent skills

### Issue tracker

Issue 以飞书多维表格（Base）跟踪，agent 经 `lark-base` 技能读写；外部 PR 不是分诊面。见 `docs/agents/issue-tracker.md`。

### Triage labels

使用五个默认分诊角色（needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix），以 Base「分诊」单选字段承载。见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context：根目录 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。
