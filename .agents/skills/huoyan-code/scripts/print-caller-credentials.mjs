#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_MCP_MODULE_API_KEY,
  buildMcpSnippet,
  resolveMcpHost,
} from './mcp-endpoint.mjs';

function parseHostArg(argv) {
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--mcp-host' && argv[i + 1]) return argv[++i].trim();
  }
  return undefined;
}

function npxBin() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

function readTokens() {
  const envName = (process.env.OPPO_AGENT_ENV || 'prod').trim() || 'prod';
  const path = join(homedir(), '.oppo-agent', envName, 'tokens.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readGatewayKey() {
  const fromEnv = process.env.OPPO_AGENT_GATEWAY_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execFileSync(
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
    return null;
  }
}

const mcpHost = resolveMcpHost(parseHostArg(process.argv));
const tokens = readTokens();
const gatewayApiKey = readGatewayKey();
const moduleApiKey =
  process.env.HUOYAN_CODE_MCP_MODULE_API_KEY?.trim() ||
  DEFAULT_MCP_MODULE_API_KEY;

const result = {
  ok: Boolean(gatewayApiKey),
  userId: tokens?.userId?.trim() || null,
  userName: tokens?.userName ?? null,
  gatewayApiKeyPreview: gatewayApiKey
    ? `${gatewayApiKey.slice(0, 4)}***`
    : null,
  cursorMcpJsonSnippet: buildMcpSnippet(mcpHost, moduleApiKey)['huoyan-code'],
  hint: '远程 MCP 工号由 Gateway userinfo 自动解析，仅需配置 OPPO_AGENT_GATEWAY_API_KEY',
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
