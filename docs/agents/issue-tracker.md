# Issue Tracker

这个仓库的 issue 以**飞书多维表格（Base）**跟踪。

## 工作流

- 每个 issue 是 Base 里的一条记录，字段包含：
  - `编号`（ISSUE-xx，与 `product/upgrade-spec.md` 对应）
  - `标题`
  - `目标`（一句话业务意图）
  - `验收标准`（复选清单）
  - `状态`（待开始 / 进行中 / 待验收 / 完成）
  - `分诊`（单选：五个 triage 角色，见 `triage-labels.md`）
  - `负责人`
- Agent 通过 `lark-base` 技能读写该表：创建 issue、更新状态、分诊流转。
- `product/upgrade-spec.md` 是规格源头（spec of record），Base 是执行态镜像：spec 变更后同步 Base，Base 侧的状态变化也回写 spec 的验收清单。
- 外部 PR 不是分诊面（本仓库无外部贡献者）；协作者进行中的 PR 不进 triage 队列。

## 约定

- 建 issue 时编号沿用 upgrade-spec 的 ISSUE-01~08 序列，新增需求从 ISSUE-09 起。
- 验收标准必须可勾选、可验证（接口断言、403 边界、`pnpm verify` 通过等），不接受"功能正常"这类模糊表述。
