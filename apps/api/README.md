# BudStar API

## 身份、会话、授权与审计

统一认证接口位于 `/api/auth`，支持家长手机号 OTP、学生专属账号、员工密码加二次验证和平台管理员独立身份。访问令牌有效期短，刷新令牌可轮换与撤销；旧刷新令牌重用、过期令牌和挂起账号均会被拒绝。

本地与测试 adapter 不调用真实短信服务：

- 家长：`13800138000`，验证码 `000000`
- 学生：`student@local` / `Student123!`
- 员工：`staff@local` / `Password123!`，二次验证码 `000000`
- 平台管理员：`platform@local` / `Platform123!`，二次验证码 `000000`

生产环境必须提供合规认证 adapter 和 `AUTH_TOKEN_SECRET`，任一缺失都会 fail closed。本批次不包含真实腾讯短信 adapter。

校区业务接口通过 `Authorization: Bearer <token>` 认证，并要求显式 `X-Campus-Id`。Nest Guard 将该上下文交给 `CampusAuthorizationPolicy`，按成员关系与组合角色能力并集授权。平台管理员只能访问平台能力，不会自动获得校区业务读取权限。关键登录、校区切换和授权业务写操作写入隐私安全审计记录，不记录密码、验证码或完整手机号。

## 课程包版本与班级

平台管理员通过 `/api/platform/course-packages` 创建草稿、发布与修订课程包版本。已发布版本不可原地修改；修订会创建新的草稿版本，已有班级继续绑定原版本。种子数据预置 AI 星芽种子实验班 `1.0.0`（16 主课 + 8 答疑骨架）。

教务/校区管理员在授权校区通过 `/api/admin/classes` 管理班级：创建时必须绑定已发布课程包版本，系统生成班级码，状态仅允许 `Draft → Active → Closed`。学生列表只读；跨校区访问返回 403/404。员工可通过 `/api/admin/course-packages/published` 读取可绑定版本。

## CRM 线索工作台

授权员工通过 `/api/admin/appointment-leads` 列表筛选、更新负责人/备注、执行状态流转，并查看状态历史。`CLOSED` 重开必须提供原因；非法跳转被拒绝。列表仅返回脱敏手机号。线索转为报名后可写入 `EnrollmentRecord`。

## 预约持久化

本地默认使用 `memory` 预约仓储，因此无需 PostgreSQL 即可运行测试和首条预约切片。生产环境未配置 `APPOINTMENT_LEAD_REPOSITORY` 时默认使用 `prisma`，且缺少 `DATABASE_URL` 会拒绝启动，不会静默降级到内存。

```bash
# 仅复制示例并使用本地开发值，不要提交真实密钥
cp .env.example .env

# 可选：启动你自行管理的本地 PostgreSQL 后
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm db:migrate:dev

# 已有迁移的部署环境
pnpm db:migrate:deploy
```

预约仓储通过 `APPOINTMENT_LEAD_REPOSITORY=memory|prisma` 选择。`prisma` 会在同一事务中写入 `AppointmentLead` 和初始 `AppointmentLeadStatusHistory`；数据库中必须预先存在表单所选的 `Campus.id`。

## NestJS starter reference

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
