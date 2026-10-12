# 故障排查

```bash
node scripts/ensure-ready.mjs
node scripts/check-setup.mjs
```

## 常见现象

| 现象                            | 原因                                      | 处理                                         |
| ------------------------------- | ----------------------------------------- | -------------------------------------------- |
| `NO_API_KEY` / Gateway 鉴权失败 | 环境变量未生效                            | 再跑 `ensure-ready.mjs`；重启 Agent 客户端   |
| `INVALID_API_KEY`               | Key 过期                                  | `ensure-ready.mjs` 会尝试 `gateway create`   |
| `USER_ID_MISMATCH`              | mcp.json 多配了与 Key 不一致的工号 header | 删掉多余工号 header；再跑 `ensure-ready.mjs` |
| `INSUFFICIENT_ACCESS` / 403     | 非仓库 Developer+                         | 先 `huoyan_get_my_repo_access` 查角色        |
| MCP 401 module Key              | URL `?apiKey=` 错误                       | 应为 `mcp_huoyan_code_local_agent`           |
| 刚写完 env 仍失败               | 客户端未重启                              | 完全退出并重启 Cursor                        |
