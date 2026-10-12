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
    } catch {
      if (!this.config.fallbackEndpoint || !this.config.fallbackApiKey) {
        throw new Error('Primary AI failed and no fallback configured');
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

function defaultTransport(
  _endpoint: string,
  _apiKey: string,
  input: AiGatewayChatInput,
): Promise<string> {
  // Deterministic stub for tests/local when remote provider is selected with keys.
  return Promise.resolve(
    `（远程模型）已收到：${input.userMessage.slice(0, 80)}`,
  );
}
