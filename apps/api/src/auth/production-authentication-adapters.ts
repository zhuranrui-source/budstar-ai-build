import { createHash, createHmac } from 'node:crypto';
import { ApiException } from '../http/api-error';
import { PrismaService } from '../database/prisma.service';
import type {
  AuthenticationAdapters,
  SecondFactorVerifier,
  VerificationCodeSender,
  VerificationCodeStore,
} from './authentication-boundaries';

export type ProductionAuthenticationAdapterConfig = {
  tencentSms?: {
    secretId: string;
    secretKey: string;
    sdkAppId: string;
    signName: string;
    templateId: string;
    region: string;
  };
  secondFactor?: {
    verifyUrl: string;
    bearerToken: string;
  };
};

export function productionAuthenticationAdapterConfig(
  environment: NodeJS.ProcessEnv,
): ProductionAuthenticationAdapterConfig {
  const smsValues = [
    environment.TENCENT_SMS_SECRET_ID,
    environment.TENCENT_SMS_SECRET_KEY,
    environment.TENCENT_SMS_SDK_APP_ID,
    environment.TENCENT_SMS_SIGN_NAME,
    environment.TENCENT_SMS_TEMPLATE_ID,
  ];
  const secondFactorValues = [
    environment.SECOND_FACTOR_VERIFY_URL,
    environment.SECOND_FACTOR_BEARER_TOKEN,
  ];
  return {
    tencentSms: smsValues.every(Boolean)
      ? {
          secretId: smsValues[0]!,
          secretKey: smsValues[1]!,
          sdkAppId: smsValues[2]!,
          signName: smsValues[3]!,
          templateId: smsValues[4]!,
          region: environment.TENCENT_SMS_REGION ?? 'ap-guangzhou',
        }
      : undefined,
    secondFactor: secondFactorValues.every(Boolean)
      ? {
          verifyUrl: secondFactorValues[0]!,
          bearerToken: secondFactorValues[1]!,
        }
      : undefined,
  };
}

export function createProductionAuthenticationAdapters(
  prisma: PrismaService,
  config: ProductionAuthenticationAdapterConfig,
): AuthenticationAdapters {
  const missing = [
    ...(config.tencentSms ? [] : ['tencent-sms']),
    ...(config.secondFactor ? [] : ['second-factor']),
  ];
  return {
    verificationCodeSender: config.tencentSms
      ? new TencentSmsSender(config.tencentSms)
      : unavailableSender(),
    verificationCodeStore: new PrismaVerificationCodeStore(prisma),
    secondFactorVerifier: config.secondFactor
      ? new HttpSecondFactorVerifier(config.secondFactor)
      : unavailableSecondFactor(),
    readiness: () => ({
      ready: missing.length === 0,
      degradedReasons: missing.map((name) => `${name}-not-configured`),
    }),
  };
}

class PrismaVerificationCodeStore implements VerificationCodeStore {
  constructor(private readonly prisma: PrismaService) {}

  async issue(
    destination: string,
    code: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.client.authenticationVerificationCode.upsert({
      where: { destination },
      create: { destination, codeHash: hash(code), expiresAt },
      update: { codeHash: hash(code), expiresAt },
    });
  }

  async consume(
    destination: string,
    code: string,
    now: Date,
  ): Promise<boolean> {
    const deleted =
      await this.prisma.client.authenticationVerificationCode.deleteMany({
        where: { destination, codeHash: hash(code), expiresAt: { gt: now } },
      });
    return deleted.count === 1;
  }
}

class HttpSecondFactorVerifier implements SecondFactorVerifier {
  constructor(
    private readonly config: NonNullable<
      ProductionAuthenticationAdapterConfig['secondFactor']
    >,
  ) {}

  async verify(subjectId: string, code: string): Promise<boolean> {
    const response = await fetch(this.config.verifyUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subjectId, code }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { valid?: unknown };
    return result.valid === true;
  }
}

class TencentSmsSender implements VerificationCodeSender {
  constructor(
    private readonly config: NonNullable<
      ProductionAuthenticationAdapterConfig['tencentSms']
    >,
  ) {}

  async send(destination: string, code: string): Promise<void> {
    const host = 'sms.tencentcloudapi.com';
    const timestamp = Math.floor(Date.now() / 1_000);
    const date = new Date(timestamp * 1_000).toISOString().slice(0, 10);
    const payload = JSON.stringify({
      PhoneNumberSet: [destination],
      SmsSdkAppId: this.config.sdkAppId,
      SignName: this.config.signName,
      TemplateId: this.config.templateId,
      TemplateParamSet: [code],
    });
    const canonicalRequest = [
      'POST',
      '/',
      '',
      `content-type:application/json; charset=utf-8\nhost:${host}\n`,
      'content-type;host',
      hash(payload),
    ].join('\n');
    const credentialScope = `${date}/sms/tc3_request`;
    const stringToSign = [
      'TC3-HMAC-SHA256',
      timestamp,
      credentialScope,
      hash(canonicalRequest),
    ].join('\n');
    const secretDate = hmac(`TC3${this.config.secretKey}`, date);
    const secretService = hmac(secretDate, 'sms');
    const secretSigning = hmac(secretService, 'tc3_request');
    const signature = hmac(secretSigning, stringToSign).toString('hex');
    const authorization =
      `TC3-HMAC-SHA256 Credential=${this.config.secretId}/${credentialScope}, ` +
      `SignedHeaders=content-type;host, Signature=${signature}`;
    const response = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json; charset=utf-8',
        Host: host,
        'X-TC-Action': 'SendSms',
        'X-TC-Region': this.config.region,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Version': '2021-01-11',
      },
      body: payload,
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as {
      Response?: { Error?: { Message?: string } };
    };
    if (!response.ok || result.Response?.Error) {
      throw new Error(result.Response?.Error?.Message ?? 'Tencent SMS failed');
    }
  }
}

function unavailableSender(): VerificationCodeSender {
  return { send: () => Promise.reject(unavailable()) };
}

function unavailableSecondFactor(): SecondFactorVerifier {
  return { verify: () => Promise.reject(unavailable()) };
}

function unavailable(): ApiException {
  return new ApiException(
    503,
    'SERVICE_UNAVAILABLE',
    '认证服务尚未完成生产配置',
  );
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
