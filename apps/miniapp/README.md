# @budstar/miniapp — BudStar 家庭视图微信小程序

基于 Taro 4 + React + TypeScript 构建，编译目标为微信小程序。页面使用微信原生导航栏、原生 `tabBar`、授权按钮、下拉刷新、选择器和弹窗，不依赖第三方 UI 框架。

## 视觉基准

小程序视觉统一参考仓库已有 Web 原型：

- `demo/prototype.html?variant=C`：品牌主视觉与暖珊瑚配色。
- `demo/student.html`：家庭概览、最近作品、课程进度、星球动态和个人中心结构。
- `apps/consumer-web/src/styles/demo-community.css`：正式 Web 消费端的社区卡片、筛选和信息层级。

全局使用珊瑚橙 `#F4845F`、暖白 `#FFFAF6`、暖灰边框与深棕文字。微信绿只用于微信渠道或成功状态。复用并压缩后的品牌与作品素材位于 `src/assets/content/`。

## 页面与功能

- `pages/login`：冷启动自动微信登录、手动微信登录、微信手机号绑定、短信验证码兜底、验证码倒计时、登录态恢复与过期处理。
- `pages/family`：学生档案绑定和切换、班级切换、课节查看、AIGC/Vibe Coding 作品提交与重新提交、学科课程摘要、星球动态和成长报告。
- `pages/lab`：已发布学科互动课程目录，课程卡可进入详情并按顺序查看章节。
- `pages/lab/detail`：课程信息、章节目录以及章节开放状态。
- `pages/lab/content`：优先使用 HTTPS `web-view` 打开互动实验；仅有 `contentHtml` 时使用经过清理的 `RichText` 降级展示。
- `pages/planet`：按家庭授权范围查看已发布作品动态。
- `pages/profile`：账号、手机号和学生档案状态，支持手机号补绑及安全退出。

底部导航由 `src/app.config.ts` 的原生 `tabBar` 提供，图标位于 `src/assets/tabbar/`。

## 关键交互边界

- 所有 Tab 页面都会校验会话；会话缺失、过期或 API 返回 401 时清理本地状态并回到登录页。
- 微信登录成功后可绑定手机号匹配已有家庭，也可暂时跳过；家庭页和“我的”页面都保留补绑入口。
- 没有学生档案时，可在家庭页输入 8 位家庭查看码完成绑定。
- 切换学生或班级前，如果正在编辑作品，会先确认是否放弃输入。
- `DRAFT` 提交为 `SUBMITTED`；老师要求修改的 `NEEDS_REVISION` 保存后流转为 `RESUBMITTED`。
- AIGC 作品支持可选 HTTP(S) 作品链接；Vibe Coding 作品要求 GitHub 仓库和在线演示地址。
- 家庭、实验室、星球和“我的”页面均支持下拉刷新；错误态提供明确提示或重试入口。
- 实验室列表和家庭首页课程摘要都可进入课程详情；章节缺少内容时明确显示未开放，HTTPS 互动内容通过原生 `web-view` 打开。
- 退出登录使用确认弹窗和 `reLaunch`，退出后不能通过返回栈进入已登录页面。

## 环境

- `TARO_APP_API_BASE_URL`：后端 API 地址，开发默认值为 `http://localhost:3001/api`。
- `TARO_APP_PREVIEW_MODE=true`：验收预览模式。小程序直接从家庭页启动，并使用本地演示数据，不请求登录或业务 API；正式联调和发布前必须删除或设为 `false`。上传脚本会检测预览标记并阻止正式上传，但仍允许生成体验预览二维码。
- 当前 `.env` 应为真机可访问的 HTTPS API 地址。
- 微信公众平台需要把 API 域名配置为 `request` 合法域名；章节 `contentUrl` 所在的 HTTPS 域名还需配置为小程序业务域名。
- 小程序 appid 位于 `project.config.json`。
- 后端需配置 `WECHAT_MINIAPP_APP_ID` 和 `WECHAT_MINIAPP_APP_SECRET`；未配置时微信登录会返回 `WECHAT_NOT_CONFIGURED`。

## 开发与验证

从仓库根目录执行：

```bash
pnpm install
pnpm --filter @budstar/miniapp test
pnpm --filter @budstar/miniapp typecheck
pnpm exec prettier --check "apps/miniapp/**/*.{ts,tsx,css,json,md}"
pnpm --filter @budstar/miniapp build:weapp
```

构建产物位于 `apps/miniapp/dist/`。微信开发者工具可直接打开 `apps/miniapp`，并按 `project.config.json` 读取 `dist/`。

生成 CI 预览二维码：

```bash
pnpm --filter @budstar/miniapp preview:ci -- \
  --appid wxXXXXXXXX \
  --key-path /absolute/path/to/private.key
```

二维码输出到 `apps/miniapp/dist/preview-qr.png`。上传私钥和 `.env` 均不得提交到仓库。
