import type { AiGatewayReadiness } from '@budstar/contracts';
import {
  AI_TEACHER_HOMEWORK_REFUSAL,
  detectsHomeworkProxyRequest,
  truncateAiTeacherMessage,
} from '@budstar/contracts';
import type {
  AiGatewayAdapter,
  AiGatewayChatInput,
  AiGatewayChatResult,
} from './ai-gateway.boundaries';

export class MockAiGatewayAdapter implements AiGatewayAdapter {
  readonly provider = 'mock' as const;

  readiness(): AiGatewayReadiness {
    return { ready: true, provider: 'mock', degradedReasons: [] };
  }

  chat(input: AiGatewayChatInput): Promise<AiGatewayChatResult> {
    if (detectsHomeworkProxyRequest(input.userMessage)) {
      return Promise.resolve({
        content: truncateAiTeacherMessage(AI_TEACHER_HOMEWORK_REFUSAL),
        modelRoute: 'mock',
        degraded: false,
      });
    }
    const hint = input.systemPrompt.includes('VIBE_CODING')
      ? '可以先检查 GitHub README 是否写清运行步骤，再补充演示链接。'
      : '可以先明确作品目标，再优化提示词并分步迭代画面。';
    return Promise.resolve({
      content: truncateAiTeacherMessage(
        `围绕当前课节，我们一步步来：${hint} 你现在卡在哪一步？`,
      ),
      modelRoute: 'mock',
      degraded: false,
    });
  }
}

export class DegradedAiGatewayAdapter implements AiGatewayAdapter {
  readonly provider = 'remote' as const;

  constructor(private readonly reasons: string[]) {}

  readiness(): AiGatewayReadiness {
    return {
      ready: false,
      provider: 'degraded',
      degradedReasons: this.reasons,
    };
  }

  chat(): Promise<AiGatewayChatResult> {
    return Promise.reject(new Error('AI gateway degraded'));
  }
}

/**
 * Remote adapter with primary/fallback routing.
 * Network calls are stubbed for local/CI; production wiring injects real HTTP.
 */
export class RemoteAiGatewayAdapter implements AiGatewayAdapter {
  readonly provider = 'remote' as const;

  constructor(
    private readonly config: {
      primaryApiKey: string;
      fallbackApiKey?: string;
      primaryEndpoint: string;
      fallbackEndpoint?: string;
    },
    private readonly transport: (
      endpoint: string,
      apiKey: string,
      input: AiGatewayChatInput,
    ) => Promise<string> = defaultTransport,
  ) {}

  readiness(): AiGatewayReadiness {
    return { ready: true, provider: 'remote', degradedReasons: [] };
  }

  async chat(input: AiGatewayChatInput): Promise<AiGatewayChatResult> {
    if (detectsHomeworkProxyRequest(input.userMessage)) {
      return {
        content: truncateAiTeacherMessage(AI_TEACHER_HOMEWORK_REFUSAL),
        modelRoute: 'primary',
        degraded: false,
      };
    }
    try {
      const content = await this.transport(
        this.config.primaryEndpoint,
        this.config.primaryApiKey,
        input,
      );
      return {
        content: truncateAiTeacherMessage(content),
        modelRoute: 'primary',
        degraded: false,
      };
    } catch (cause) {
      if (!this.config.fallbackEndpoint || !this.config.fallbackApiKey) {
        throw new Error(
          'Primary AI failed and no fallback configured: ' +
            (cause instanceof Error ? cause.message : String(cause)),
        );
      }
      const content = await this.transport(
        this.config.fallbackEndpoint,
        this.config.fallbackApiKey,
        input,
      );
      return {
        content: truncateAiTeacherMessage(content),
        modelRoute: 'fallback',
        degraded: true,
      };
    }
  }
}

/**
 * OpenAI 兼容传输（智谱 BigModel coding 等）：
 * POST {endpoint}/chat/completions，Bearer 鉴权，messages 协议。
 * endpoint 传 base url（如 https://open.bigmodel.cn/api/coding/paas/v4），
 * 模型可用 AI_MODEL 覆盖，默认 glm-4.6。
 */
async function defaultTransport(
  endpoint: string,
  apiKey: string,
  input: AiGatewayChatInput,
): Promise<string> {
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`;
  const messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> = [];
  if (input.systemPrompt)
    messages.push({ role: 'system', content: input.systemPrompt });
  for (const item of input.history) messages.push(item);
  messages.push({ role: 'user', content: input.userMessage });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? 'glm-4.6',
      messages,
      temperature: 0.4,
      // glm-4.6 为推理模型：reasoning_content 先消耗预算，1024 会挤空正文
      max_tokens: Number(process.env.AI_MAX_TOKENS ?? 4096),
    }),
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS ?? 90_000)),
  });
  if (!response.ok) {
    throw new Error(`AI gateway ${response.status}`);
  }
  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  };
  const message = result.choices?.[0]?.message;
  const content = message?.content;
  if (!content) {
    throw new Error(
      `AI gateway empty response (finish=${result.choices?.[0]?.finish_reason})`,
    );
  }
  return content;
}
