# 新建远端分支

在 `code.oppoer.me` 仓库基于源分支**立刻**创建远端分支。纯代码管理操作，不关联外部任务单。

## 触发词

新建分支、创建分支、远端建分支、从 master 拉 feature 分支

## 工具

`huoyan_create_branch`

| 参数         | 必填 | 说明                                 |
| ------------ | ---- | ------------------------------------ |
| `repoUrl`    | 是   | `http(s)://code.oppoer.me/.../*.git` |
| `ref`        | 是   | 源分支                               |
| `branchName` | 是   | 新分支名                             |

## 流程

1. 建议 `huoyan_get_my_repo_access` 确认 Developer+
2. 可选 `huoyan_list_branches` 确认源分支存在
3. **HARD-GATE** 向用户确认三要素
4. 调用工具：
   - `action=CREATED` → 已创建
   - `action=ALREADY_EXISTS` → 幂等成功

## 红线

- **禁止**未确认三要素就调用
- **禁止**将本能力当成其他系统的提单 `baseBranch` 配置
- **禁止**对非 `code.oppoer.me` 仓库调用
