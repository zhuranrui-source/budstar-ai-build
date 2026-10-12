# 查询本人在仓库的角色

建分支或列成员前，建议先查权限。

## 工具

`huoyan_get_my_repo_access`

| 参数         | 必填 | 说明                      |
| ------------ | ---- | ------------------------- |
| `projectRef` | 是   | 仓库 URL / 路径 / 数字 ID |

## 返回解读

| 字段                    | 含义                                              |
| ----------------------- | ------------------------------------------------- |
| `isMember: false`       | 非成员，无法做 Developer+ 操作                    |
| `roleName`              | Guest / Reporter / Developer / Maintainer / Owner |
| `accessLevel`           | GitLab 等级；写操作需 ≥ 30                        |
| `meetsDeveloperOrAbove` | 是否满足建分支、列成员等门槛                      |

## 流程

1. 确认 `projectRef`（可先 `huoyan_search_repos`）
2. 调用工具
3. 若 `meetsDeveloperOrAbove: false`，向用户说明权限不足，**禁止**强行调用写操作工具
