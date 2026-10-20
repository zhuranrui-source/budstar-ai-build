# 待配置 / 待运维清单（后续提醒）

> 记录时间：2026-07-14  
> 范围：Web 交付 W-00～W-19 已完成后，仍依赖外部账号、云资源或人工决策的事项。  
> 代码与文档多数已就绪；未完成项主要是**真实环境配置与联调**。

提醒口令：用户说「提醒待配置」或「试点上线前检查」时，优先打开本文件逐项核对。

---

## P0 — 试点上线前必须完成

| ID     | 事项                       | 现状                                                                                                                                  | 要做什么                                                                       | 参考                                                                      |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| OPS-01 | 腾讯云大陆 PostgreSQL      | 仅有本地/CI 连接串样例                                                                                                                | 开通实例，写入生产 `DATABASE_URL`，执行 `db:migrate:deploy` + `db:seed`        | `.env.example`、`docs/tencent-cloud-production.md`                        |
| OPS-02 | 腾讯云短信 OTP             | 本地固定验证码                                                                                                                        | 配置 `TENCENT_SMS_*`，去掉生产对本地码的依赖；验证家长登录真发短信             | `.env.example`、`apps/api/src/auth/production-authentication-adapters.ts` |
| OPS-03 | 员工二次验证供应方         | mock / fail-closed                                                                                                                    | 配置 `SECOND_FACTOR_VERIFY_URL` + `SECOND_FACTOR_BEARER_TOKEN`（或选定供应商） | 同上                                                                      |
| OPS-04 | 腾讯云 COS                 | 本地磁盘 adapter                                                                                                                      | 设 `OBJECT_STORAGE_PROVIDER=cos` 及 Secret/Bucket/Region；验证预签名上传       | `apps/api/src/object-storage/`、`docs/tencent-cloud-production.md`        |
| OPS-05 | HTTPS + CORS 生产白名单    | 域名 budstar-ai.site 已购（企业实名变更中）；生产主机=轻量应用服务器 lhins-nkv81kx8 / 106.54.203.207 上海；备案授权码已生成并提交备案 | 证书、仅 HTTPS 入口；`CORS_ORIGINS` 改为真实域名                               | `docs/tencent-cloud-production.md`                                        |
| OPS-06 | 密钥与 `AUTH_TOKEN_SECRET` | 测试密钥                                                                                                                              | 用 SSM/环境注入生产密钥，禁止入库、禁止进前端包                                | ADR-0005、`.env.example`                                                  |
| OPS-07 | Staging / Prod 隔离        | 文档有清单                                                                                                                            | 分库分桶（或分账号），Staging 先演练再 Prod                                    | `docs/tencent-cloud-production.md`                                        |
| OPS-08 | 备份恢复演练               | 未做                                                                                                                                  | PostgreSQL 日备 + 一次恢复验证                                                 | `docs/tencent-cloud-production.md`                                        |

## P1 — 体验与观测增强

| ID     | 事项                    | 现状                                                                                            | 要做什么                                           | 参考                                           |
| ------ | ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| OPS-09 | AI 主备模型真实接入     | **主备已接**（智谱 glm-4.6 + DeepSeek deepseek-chat，容灾切换实测通过）；生产密钥走密钥管理注入 | 生产环境经密钥管理补配同套变量                     | `.env.example`、`apps/api/src/ai-teacher/`     |
| OPS-10 | 点评/五维草稿接真实模型 | 服务内 mock 文本                                                                                | 将反馈草稿生成接到同一 AI 网关，保留人工发布       | `apps/api/src/feedback/`                       |
| OPS-11 | 监控告警落地            | 观测基线文档已有                                                                                | 配置 P95、AI 失败率、上传失败、登录失败告警看板    | `docs/observability.md`                        |
| OPS-12 | 本地/CI 真库并发测试    | 无 `TEST_DATABASE_URL` 时跳过                                                                   | 本地需要时导出 `TEST_DATABASE_URL` 后再跑 API 测试 | `apps/api/test/prisma-concurrency.e2e-spec.ts` |

## P2 — 后续产品线（非本阶段 Web 缺口）

| ID     | 事项                 | 说明                                                      |
| ------ | -------------------- | --------------------------------------------------------- |
| OPS-13 | Android / iOS 客户端 | Web API 就绪后再开；见 `product/prd.md`                   |
| OPS-14 | 明确不做             | 在线支付、公开社区搜索、任意 SQL、企微自动触达 — 勿当遗漏 |

---

## 建议提醒节奏

1. **准备试点环境时**：核对 OPS-01～OPS-08
2. **第一次真实家长登录前**：重点 OPS-02、OPS-03、OPS-06
3. **第一次学生交作品前**：重点 OPS-04、OPS-09
4. **正式对外演示前**：OPS-05、OPS-07、OPS-08、OPS-11

勾选进度可同步回 `product/pilot-acceptance.md` 与 `docs/tencent-cloud-production.md` 部署检查表。
