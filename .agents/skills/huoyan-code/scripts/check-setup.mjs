#!/usr/bin/env node
/**
 * 检查火眼代码管理 MCP 前置条件（本机，不调用远程 MCP）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveMcpBaseUrl, resolveMcpHost } from './mcp-endpoint.mjs';

function npxBin() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function check(name, ok, detail) {
  return { name, ok, detail };
}

const checks = [];
const mcpPath = join(homedir(), '.cursor', 'mcp.json');

const envKey = process.env.OPPO_AGENT_GATEWAY_API_KEY?.trim();
let cliKey = null;
try {
  cliKey = execFileSync(
    npxBin(),
    [
      '--yes',
      '--registry=http://admin.npm.oppoer.me',
      'oppo-agent-gateway',
      '-H',
      'show',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
} catch {
  cliKey = null;
}

checks.push(
  check(
    'gatewayApiKey',
    Boolean(envKey || cliKey),
    envKey
      ? `环境变量已设置（${envKey.slice(0, 4)}***）`
      : cliKey
        ? `CLI 可读（${cliKey.slice(0, 4)}***）`
        : '无 Key；请运行 ensure-ready.mjs',
  ),
);

let hasMcpEntry = false;
let mcpUrl = null;
if (existsSync(mcpPath)) {
  try {
    const cfg = JSON.parse(readFileSync(mcpPath, 'utf8'));
    mcpUrl = cfg?.mcpServers?.['huoyan-code']?.url ?? null;
    hasMcpEntry = Boolean(mcpUrl);
  } catch {
    hasMcpEntry = false;
  }
}
checks.push(
  check(
    'mcp.json.huoyan-code',
    hasMcpEntry,
    hasMcpEntry ? mcpUrl : `缺少 ${mcpPath} 中的 huoyan-code 配置`,
  ),
);

const mcpHost = resolveMcpHost();
const mcpBaseUrl = resolveMcpBaseUrl(mcpHost);
const allOk = checks.every((c) => c.ok);

console.log(
  JSON.stringify(
    {
      ok: allOk,
      checks,
      needsCursorRestart: Boolean(!envKey && cliKey),
      defaultMcpHost: mcpHost,
      defaultMcpBaseUrl: mcpBaseUrl,
    },
    null,
    2,
  ),
);
process.exit(allOk ? 0 : 1);
