# 腾讯云中国大陆生产化清单（W-18）

## 目标

单校区试点上线于腾讯云中国大陆地域，满足未成年人数据本地化与 ADR-0005。

## 组件与配置

| 能力     | 推荐产品            | 配置项                                                     | 生产 fail-closed      |
| -------- | ------------------- | ---------------------------------------------------------- | --------------------- |
| 计算     | 云服务器 / TKE      | `NODE_ENV=production`                                      | 缺密钥/缺 DB 拒绝启动 |
| 数据库   | 云数据库 PostgreSQL | `DATABASE_URL`                                             | 必填；禁止生产内存仓  |
| 对象存储 | COS                 | `OBJECT_STORAGE_PROVIDER=cos` + SecretId/Key/Bucket/Region | COS 缺配置拒绝上传    |
| 短信     | 短信 SMS            | 生产短信 adapter                                           | 缺配置拒绝 OTP        |
| HTTPS    | CLB / CDN 证书      | 仅 HTTPS 入口                                              | 禁止明文公网入口      |
| 密钥     | SSM / 环境注入      | 不入库、不进前端包                                         | 密钥缺失拒绝启动      |
| 备份     | PostgreSQL 自动备份 | 日备 + 保留策略                                            | 试点前验证恢复演练    |

## Staging / Prod

1. Staging 与 Prod 分账号或至少分 VPC/库/桶。
2. CORS 仅白名单 Web 来源，禁止 `*`。
3. 日志与对象存储默认私有；跨境与外部模型须合规评估。

## 部署检查

- [ ] `DATABASE_URL` 指向大陆地域实例
- [ ] COS 桶私有、预签名上传可用
- [ ] 短信/二次验证供应方已接入（非本地固定码）
- [ ] AI 主备密钥齐备或明确 degraded 策略
- [ ] 备份恢复演练通过
- [ ] 监控告警（见观测文档）已配置

## 本仓库相关路径

- API 环境样例：`.env.example`
- 对象存储适配：`apps/api/src/object-storage/`
- 认证 fail-closed：`apps/api/src/auth/`
- AI 网关 fail-closed：`apps/api/src/ai-teacher/`
