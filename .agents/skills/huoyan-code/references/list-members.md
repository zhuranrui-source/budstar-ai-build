# 列仓库成员

需 **Developer+** 权限。

## 工具

`huoyan_list_repo_members`

| 参数         | 必填 | 说明     |
| ------------ | ---- | -------- |
| `projectRef` | 是   | 仓库标识 |

## 流程

1. 建议先 `huoyan_get_my_repo_access` 确认 Developer+
2. 调用工具，展示成员 username、角色、accessLevel
3. 权限不足时引导用户找 Maintainer 提权
