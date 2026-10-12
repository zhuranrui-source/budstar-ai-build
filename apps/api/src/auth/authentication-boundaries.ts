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

export type AuthenticationAdapters = {
  verificationCodeSender: VerificationCodeSender;
  verificationCodeStore: VerificationCodeStore;
  secondFactorVerifier: SecondFactorVerifier;
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
  return createLocalAuthenticationAdapters({
    verificationCode,
    secondFactorCode,
  });
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
