import type {
  AiGatewayReadiness,
  AiTeacherChatResponse,
} from '@budstar/contracts';

export type AiGatewayChatInput = {
  systemPrompt: string;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type AiGatewayChatResult = {
  content: string;
  modelRoute: AiTeacherChatResponse['modelRoute'];
  degraded: boolean;
};

export interface AiGatewayAdapter {
  readonly provider: 'mock' | 'remote';
  readiness(): AiGatewayReadiness;
  chat(input: AiGatewayChatInput): Promise<AiGatewayChatResult>;
}

export type ResolveAiGatewayOptions = {
  nodeEnv: string | undefined;
  provider: string | undefined;
  primaryApiKey?: string;
  fallbackApiKey?: string;
  primaryEndpoint?: string;
  fallbackEndpoint?: string;
};

export function resolveAiGatewayAdapter(
  options: ResolveAiGatewayOptions,
  factories: {
    createMock: () => AiGatewayAdapter;
    createRemote: (config: {
      primaryApiKey: string;
      fallbackApiKey?: string;
      primaryEndpoint: string;
      fallbackEndpoint?: string;
    }) => AiGatewayAdapter;
    createDegraded: (reasons: string[]) => AiGatewayAdapter;
  },
): AiGatewayAdapter {
  const requested = (options.provider ?? 'mock').toLowerCase();

  if (requested === 'mock') {
    return factories.createMock();
  }

  if (requested === 'remote') {
    const missing: string[] = [];
    if (!options.primaryApiKey) missing.push('AI_PRIMARY_API_KEY');
    if (!options.primaryEndpoint) missing.push('AI_PRIMARY_ENDPOINT');
    if (missing.length > 0) {
      if (options.nodeEnv === 'production') {
        throw new Error(
          `AI gateway is fail-closed in production; missing ${missing.join(', ')}`,
        );
      }
      return factories.createDegraded([
        `AI configuration incomplete: ${missing.join(', ')}`,
      ]);
    }
    return factories.createRemote({
      primaryApiKey: options.primaryApiKey!,
      fallbackApiKey: options.fallbackApiKey,
      primaryEndpoint: options.primaryEndpoint!,
      fallbackEndpoint: options.fallbackEndpoint,
    });
  }

  if (options.nodeEnv === 'production') {
    throw new Error(`Unknown AI gateway provider: ${requested}`);
  }
  return factories.createDegraded([`Unknown AI provider: ${requested}`]);
}
