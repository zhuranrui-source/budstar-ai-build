# Monorepo 与模块化单体

采用 pnpm Monorepo 管理独立的 consumer-web、admin-web 两个 Next.js 应用和一个 NestJS 模块化单体 API，并共享契约、UI 与工程配置。两个 Web 的用户、发布节奏和安全边界不同，需要独立应用；首发业务仍在快速演进，模块化单体比微服务更容易保持事务一致性和低运维成本，同时保留按领域拆分的边界。
