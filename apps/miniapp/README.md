# @budstar/miniapp — BudStar 家庭视图微信小程序

Taro + React（ADR-0006/0007 已对齐的技术栈决策）。

## 页面

- `pages/login` — 微信一键登录（`wx.login` → `POST /api/auth/wechat/login`）+ 微信手机号一键绑定（`getPhoneNumber` → `POST /api/auth/wechat/bind-phone`，短信兜底待 ISSUE-05 接入）
- `pages/family` — 家庭视图入口（课节/作品/星球/报告在 ISSUE-05 落地）

## 环境

- `TARO_APP_API_BASE_URL` — 后端 API 地址（默认 `http://localhost:3001/api`）
- 小程序 `appid` 在 `project.config.json`，由 ISSUE-08 注册后填入
- 后端侧需配置 `WECHAT_MINIAPP_APP_ID` / `WECHAT_MINIAPP_APP_SECRET`，缺失时微信端点 fail-closed（`WECHAT_NOT_CONFIGURED`）

## 构建

```bash
pnpm install          # 首次安装 Taro 依赖
pnpm --filter @budstar/miniapp build:weapp
# 用微信开发者工具打开 apps/miniapp/dist
```
