# Triage Labels

技能使用五个标准分诊角色。本仓库的载体是飞书多维表格的「分诊」单选字段，选项与角色一一对应：

| mattpocock/skills 中的角色 | 本仓库的取值（Base 单选选项） | 含义                           |
| -------------------------- | ----------------------------- | ------------------------------ |
| `needs-triage`             | `needs-triage`                | 维护者需要评估该 issue         |
| `needs-info`               | `needs-info`                  | 等待报告人补充信息             |
| `ready-for-agent`          | `ready-for-agent`             | 规格完整，AFK agent 可直接领取 |
| `ready-for-human`          | `ready-for-human`             | 需要人来实现                   |
| `wontfix`                  | `wontfix`                     | 不处理                         |

当技能提到某个角色（如"打上 AFK-ready 分诊标签"）时，按本表右列在 Base 的「分诊」字段设置对应选项。
