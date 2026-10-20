#!/usr/bin/env node
/**
 * 小程序 CI 上传（miniprogram-ci，无需打开开发者工具）
 *
 * 用法：
 *   node scripts/upload-miniapp.mjs --appid wxXXXX --key-path /path/to/private.key \
 *        [--version 0.1.0] [--desc "说明"] [--preview]
 *
 * 前置：
 *   1. 已构建：pnpm --filter @budstar/miniapp build:weapp（dist/ 为最新）
 *   2. mp 后台「开发设置 → 小程序代码上传」已生成并下载密钥文件
 *   3. mp 后台「开发设置 → 服务器域名」已配置 request 合法域名（体验版起）
 *
 * preview 模式：生成预览二维码（base64 PNG 写入 dist/preview-qrcode.txt）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ci = require(
  path.resolve(
    import.meta.dirname,
    '../apps/miniapp/node_modules/miniprogram-ci',
  ),
);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const appid = flag('appid') ?? process.env.WECHAT_MINIAPP_APP_ID;
const keyPath = flag('key-path') ?? process.env.WECHAT_UPLOAD_KEY_PATH;
const mode = args.includes('--preview') ? 'preview' : 'upload';
const version = flag('version') ?? '0.1.0';
const desc = flag('desc') ?? `CI ${mode} ${new Date().toISOString()}`;

if (!appid || !keyPath) {
  console.error(
    '缺少参数：--appid（或环境变量 WECHAT_MINIAPP_APP_ID）与 --key-path（WECHAT_UPLOAD_KEY_PATH）',
  );
  process.exit(1);
}
if (!fs.existsSync(keyPath)) {
  console.error(`密钥文件不存在：${keyPath}`);
  process.exit(1);
}

const projectRoot = path.resolve(import.meta.dirname, '../apps/miniapp');

async function main() {
  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath: projectRoot,
    privateKeyPath: keyPath,
    ignores: ['node_modules/**/*'],
  });

  if (mode === 'preview') {
    const result = await ci.preview({
      project,
      desc,
      setting: { es6: true, minify: true },
      qrcodeFormat: 'image',
      qrcodeOutputDest: path.join(projectRoot, 'dist/preview-qr.png'),
      onProgressUpdate: () => {},
    });
    console.log(
      '预览二维码已生成：apps/miniapp/dist/preview-qrcode.txt（base64 PNG）',
    );
    console.log(JSON.stringify(result ?? { ok: true }));
    return;
  }

  const result = await ci.upload({
    project,
    version,
    desc,
    setting: { es6: true, minify: true },
    onProgressUpdate: () => {},
  });
  console.log(`上传完成：v${version}`, JSON.stringify(result ?? {}));
}

main().catch((cause) => {
  console.error('CI 失败：', cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
