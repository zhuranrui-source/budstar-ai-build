# BudStar AI 机构后台

admin-web 提供员工与平台管理员的独立入口，调用统一 API 完成密码登录、二次验证、会话刷新和授权数据加载。员工进入业务模块前必须选择明确校区；平台管理员仅能进入平台治理模块，不能切换或伪装为校区成员。

## 本地开发

先在仓库根目录启动 API 与后台：

```bash
pnpm --filter @budstar/api dev
pnpm --filter @budstar/admin-web dev
```

默认 API 地址为 `http://localhost:3001/api`，可通过 `NEXT_PUBLIC_API_BASE_URL` 覆盖。本地 adapter 账号：

- 员工：`staff@local` / `Password123!`
- 平台管理员：`platform@local` / `Platform123!`
- 二次验证码：`000000`

这些账号只用于本地和自动化测试。生产环境缺少真实认证 adapter 或 `AUTH_TOKEN_SECRET` 时 API 会拒绝启动。

## 验证

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
