---
name: huoyan-code
version: 1.0.1
tags: huoyan-code,火眼代码管理,GitLab,代码仓库,新建分支
agentTypes: universal
description: >-
  火眼代码管理 MCP 入口：搜 code.oppoer.me 仓库、查本人在仓角色、列成员/分支、新建远端分支（含 Developer+ 权限校验，纯代码管理能力）。
  用户提到火眼代码管理、搜代码仓、查仓库权限、列分支、建远端分支、GitLab 成员、huoyan、火眼建分支时优先用本 Skill。
---

# 火眼代码管理（huoyan-code MCP）

<EXTREMELY-IMPORTANT>
本 Skill 仅覆盖 **code.oppoer.me** 的仓库查询与代码管理能力（搜仓、权限、成员、分支、建分支）。
**禁止**向用户解释 MCP、BFF、userinfo 等内部实现；只说「火眼代码管理」「你的仓库权限」等产品语言。
</EXTREMELY-IMPORTANT>

**分发**：整目录复制到 `~/.agents/skills/huoyan-code/` 或 `~/.cursor/skills/huoyan-code/`。

能力总览见 `references/execution-layer.md`。

## 工作流

```
Phase 0  静默环境准备（每次触发必跑）
  → Phase 1  MCP 鉴权探活
  → Phase 2  按意图路由（搜仓 / 查角色 / 列成员 / 列分支 / 建分支）
```

### 核心原则

| 原则              | 说明                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| **代码管理专用**  | 搜仓、查权限、列成员/分支、建远端分支均用 `huoyan_*` 工具               |
| **权限先行**      | 写操作前优先 `huoyan_get_my_repo_access`，需 Developer+                 |
| **无感知安装**    | 用户只说业务意图；禁止要求用户说「安装 huoyan-code」                    |
| **仅 Bearer Key** | MCP 配置只需 `OPPO_AGENT_GATEWAY_API_KEY`；工号由 Gateway userinfo 解析 |
| **少打断**        | SSO、重启客户端、建分支确认时交互                                       |

---

## Phase 0：静默环境准备（强制）

响应业务请求**之前**，`cd` 到本 Skill 根目录执行：

```bash
node scripts/ensure-ready.mjs --quiet
```

| 结果                       | 动作                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `ok: true` 且无需重启      | 进入 Phase 1                                                |
| `needsCursorRestart: true` | 用 `references/restart-agent-client-hint.md` 一句话提示重启 |
| `needsSso: true`           | 提示浏览器完成 OPPO 登录后重跑 ensure-ready                 |
| `ok: false`                | 见 `references/troubleshooting.md`                          |

---

## Phase 1：MCP 鉴权探活

调用 `huoyan_search_repos`，`perPage: 1`（轻量验证 Gateway Key + userinfo）。

| 结果                     | 动作                                 |
| ------------------------ | ------------------------------------ |
| `success` 或正常仓库列表 | 记录返回中的身份上下文，进入 Phase 2 |
| Gateway 鉴权失败         | 再跑 Phase 0；见 troubleshooting     |

---

## Phase 2：能力路由

| 意图                            | 参考                          | MCP 工具                    |
| ------------------------------- | ----------------------------- | --------------------------- |
| 搜仓库                          | `references/search-repos.md`  | `huoyan_search_repos`       |
| 我在仓库是什么角色 / 有没有权限 | `references/repo-access.md`   | `huoyan_get_my_repo_access` |
| 列成员                          | `references/list-members.md`  | `huoyan_list_repo_members`  |
| 列分支名                        | `references/list-branches.md` | `huoyan_list_branches`      |
| 新建远端分支                    | `references/create-branch.md` | `huoyan_create_branch`      |

### 推荐组合

- **建分支前**：`get_my_repo_access` →（可选）`list_branches` → HARD-GATE → `create_branch`
- **不知道仓库路径**：先 `search_repos` 再后续操作

---

## MCP 工具一览

| 工具                        | 用途                                   |
| --------------------------- | -------------------------------------- |
| `huoyan_search_repos`       | 按关键字搜可见仓库                     |
| `huoyan_get_my_repo_access` | 查本人在仓库角色（任意成员等级）       |
| `huoyan_list_repo_members`  | 列成员（Developer+）                   |
| `huoyan_list_branches`      | 列分支名（Developer+）                 |
| `huoyan_create_branch`      | 新建远端分支（Developer+；已存在幂等） |

---

## 红线

- **禁止**将 `huoyan_create_branch` 绑定到外部任务/提单流程的 `baseBranch` 配置
- **禁止**在 Developer+ 未确认时调用写操作工具
- **禁止**跳过 Phase 0
- **禁止**在 MCP 配置写明文 Key 或额外工号 header（仅需 `Authorization`）
- **禁止**向用户暴露 GitLab 超管 PAT、内部 API 路径

---

## 脚本

| 脚本                                   | 用途                           |
| -------------------------------------- | ------------------------------ |
| `scripts/ensure-ready.mjs`             | **静默准备（Phase 0 主入口）** |
| `scripts/check-setup.mjs`              | 只读检查                       |
| `scripts/print-caller-credentials.mjs` | 只读 Gateway Key 与 mcp 片段   |

## 延伸阅读

- `references/mcp-config-template.md` — MCP 配置
- `references/troubleshooting.md` — 排障
- `references/create-branch.md` — 建分支 HARD-GATE
