# MCP 配置模板

由 `scripts/ensure-ready.mjs` 自动合并 `huoyan-code` 到 `~/.cursor/mcp.json`；仅需 Gateway Key（工号由 userinfo 解析）。

## Skill 安装路径

| 场景   | 路径                                                               |
| ------ | ------------------------------------------------------------------ |
| 用户级 | `~/.agents/skills/huoyan-code/` 或 `~/.cursor/skills/huoyan-code/` |
| 项目级 | 项目 `.agents/skills/huoyan-code/`                                 |

## 默认端点

| 项          | 默认值                          |
| ----------- | ------------------------------- |
| Host        | `digital-employee-cn.oppoer.me` |
| 模块 apiKey | `mcp_huoyan_code_local_agent`   |
| 覆盖 Host   | `HUOYAN_CODE_MCP_HOST`          |

## `mcp.json` 模板

```json
{
  "mcpServers": {
    "huoyan-code": {
      "url": "http://digital-employee-cn.oppoer.me/mcp/huoyan-code?apiKey=mcp_huoyan_code_local_agent",
      "type": "streamable/http",
      "headers": {
        "Authorization": "Bearer ${env:OPPO_AGENT_GATEWAY_API_KEY}"
      }
    }
  }
}
```

`OPPO_AGENT_GATEWAY_API_KEY` 可与其它 MCP 模块共用；本模块仅需 Bearer Key。

## 鉴权探活

本模块无独立 `check_auth` 工具；Phase 1 用 `huoyan_search_repos`（`perPage: 1`）轻量探活即可。
