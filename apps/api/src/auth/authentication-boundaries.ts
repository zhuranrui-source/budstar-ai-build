export interface VerificationCodeSender {
  send(destination: string, code: string): Promise<void>;
}

export interface VerificationCodeStore {
  issue(destination: string, code: string, expiresAt: Date): Promise<void>;
  consume(destination: string, code: string, now: Date): Promise<boolean>;
}

export interface SecondFactorVerifier {
  verify(subjectId: string, code: string): Promise<boolean>;
}

/** ADR-0006：微信小程序登录身份解析（code2session）。 */
export interface WechatIdentityResolver {
  code2session(code: string): Promise<{ openid: string; unionid?: string }>;
}

/** ADR-0006：微信手机号一键授权解析。 */
export interface WechatPhoneNumberResolver {
  getPhoneNumber(code: string): Promise<{ phoneNumber: string }>;
}

export type AuthenticationAdapters = {
  verificationCodeSender: VerificationCodeSender;
  verificationCodeStore: VerificationCodeStore;
  secondFactorVerifier: SecondFactorVerifier;
  /** 微信登录解析器；缺失时微信端点必须 fail-closed（ADR-0006）。 */
  wechatCodeResolver?: WechatIdentityResolver;
  wechatPhoneNumberResolver?: WechatPhoneNumberResolver;
  readiness?: () => {
    ready: boolean;
    degradedReasons: string[];
  };
};

type ResolveAuthenticationAdaptersOptions = {
  nodeEnv: string | undefined;
  verificationAdapter: AuthenticationAdapters | undefined;
};

export function resolveAuthenticationAdapters({
  nodeEnv,
  verificationAdapter,
}: ResolveAuthenticationAdaptersOptions): AuthenticationAdapters {
  if (verificationAdapter) {
    return verificationAdapter;
  }

  if (nodeEnv === 'production') {
    throw new Error('Production verification adapters are not configured');
  }

  const verificationCode = process.env.LOCAL_VERIFICATION_CODE;
  const secondFactorCode = process.env.LOCAL_SECOND_FACTOR_CODE;
  if (!verificationCode || !secondFactorCode) {
    throw new Error(
      'Local verification codes must be explicitly configured outside production',
    );
  }
  return {
    ...createLocalAuthenticationAdapters({
      verificationCode,
      secondFactorCode,
    }),
    ...createLocalWechatAdapters(),
  };
}

/** 本地/测试用微信解析器：openid 与手机号由 code 确定性派生。 */
export function createLocalWechatAdapters(): {
  wechatCodeResolver: WechatIdentityResolver;
  wechatPhoneNumberResolver: WechatPhoneNumberResolver;
} {
  return {
    wechatCodeResolver: {
      code2session: (code) =>
        Promise.resolve({
          openid: `mock-openid-${Buffer.from(code)
            .toString('hex')
            .slice(0, 24)}`,
        }),
    },
    wechatPhoneNumberResolver: {
      getPhoneNumber: (code) =>
        Promise.resolve({
          phoneNumber:
            code.length >= 4
              ? `13800${code.slice(-6).replace(/\D/g, '').padStart(6, '0')}`
              : '13800138000',
        }),
    },
  };
}

export function createLocalAuthenticationAdapters(codes: {
  verificationCode: string;
  secondFactorCode: string;
}): AuthenticationAdapters {
  const issued = new Map<string, { code: string; expiresAt: Date }>();
  return {
    verificationCodeSender: {
      send: () => Promise.resolve(),
    },
    verificationCodeStore: {
      issue: (destination, code, expiresAt) => {
        issued.set(destination, { code, expiresAt });
        return Promise.resolve();
      },
      consume: (destination, code, now) => {
        const current = issued.get(destination);
        if (
          !current ||
          current.expiresAt <= now ||
          current.code !== code ||
          code !== codes.verificationCode
        ) {
          return Promise.resolve(false);
        }
        issued.delete(destination);
        return Promise.resolve(true);
      },
    },
    secondFactorVerifier: {
      verify: (_subjectId, code) =>
        Promise.resolve(code === codes.secondFactorCode),
    },
    readiness: () => ({ ready: true, degradedReasons: [] }),
  };
}
