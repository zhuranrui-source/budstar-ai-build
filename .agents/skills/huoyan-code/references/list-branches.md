# 列仓库分支

需 **Developer+** 权限。建分支前可用于确认源分支是否存在。

## 工具

`huoyan_list_branches`

| 参数         | 必填 | 说明             |
| ------------ | ---- | ---------------- |
| `projectRef` | 是   | 仓库标识         |
| `search`     | 否   | 分支名关键字过滤 |

## 流程

1. 确认 `projectRef` 与 Developer+ 权限
2. 可选 `search` 缩小结果
3. 将分支列表交给用户选择源分支
