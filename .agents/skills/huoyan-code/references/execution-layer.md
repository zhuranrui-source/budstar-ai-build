# 火眼代码管理能力总览

通过 MCP 模块 `huoyan-code` 操作 **code.oppoer.me** 仓库。

## 权限模型

| 操作                     | 门槛                                     |
| ------------------------ | ---------------------------------------- |
| 搜仓库                   | 登录用户可见范围                         |
| 查本人在仓库角色         | 任意成员（非成员返回 `isMember: false`） |
| 列成员 / 列分支 / 建分支 | **Developer+**（`access_level >= 30`）   |

## 工具与参考

| 意图             | 参考               | MCP 工具                    |
| ---------------- | ------------------ | --------------------------- |
| 搜仓库           | `search-repos.md`  | `huoyan_search_repos`       |
| 查我在仓库的角色 | `repo-access.md`   | `huoyan_get_my_repo_access` |
| 列成员           | `list-members.md`  | `huoyan_list_repo_members`  |
| 列分支           | `list-branches.md` | `huoyan_list_branches`      |
| 新建远端分支     | `create-branch.md` | `huoyan_create_branch`      |

## projectRef 格式

以下均可：

- 完整 URL：`https://code.oppoer.me/group/project.git`
- 项目路径：`group/project`
- 数字项目 ID

## 红线

- **禁止**向用户暴露 BFF / 内部接口路径
- **禁止**将 `huoyan_create_branch` 绑定到外部任务/提单配置
- 敏感写操作前优先 `huoyan_get_my_repo_access` 确认 Developer+
