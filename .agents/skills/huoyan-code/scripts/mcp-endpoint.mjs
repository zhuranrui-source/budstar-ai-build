/** 火眼代码管理 MCP 默认配置（与 digital-employee-app 同域名） */
export const DEFAULT_MCP_HOST = 'digital-employee-cn.oppoer.me';
export const DEFAULT_MCP_SCHEME = 'http';
export const DEFAULT_MCP_MODULE_API_KEY = 'mcp_huoyan_code_local_agent';

export function resolveMcpHost(override) {
  return (
    override?.trim() ||
    process.env.HUOYAN_CODE_MCP_HOST?.trim() ||
    DEFAULT_MCP_HOST
  );
}

export function resolveMcpScheme() {
  return process.env.HUOYAN_CODE_MCP_SCHEME?.trim() || DEFAULT_MCP_SCHEME;
}

export function resolveMcpBaseUrl(host = resolveMcpHost()) {
  return `${resolveMcpScheme()}://${host}`;
}

export function buildMcpModuleUrl(
  host,
  moduleApiKey = DEFAULT_MCP_MODULE_API_KEY,
) {
  return `${resolveMcpBaseUrl(host)}/mcp/huoyan-code?apiKey=${moduleApiKey}`;
}

export function buildMcpSnippet(
  host,
  moduleApiKey = DEFAULT_MCP_MODULE_API_KEY,
) {
  return {
    'huoyan-code': {
      url: buildMcpModuleUrl(host, moduleApiKey),
      type: 'streamable/http',
      headers: {
        Authorization: 'Bearer ${env:OPPO_AGENT_GATEWAY_API_KEY}',
      },
    },
  };
}
