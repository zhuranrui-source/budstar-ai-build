import { AuthenticationService } from './authentication.service';
import { InMemoryAuthenticationSessionRepository } from './authentication-session.repository';
import { InMemoryAuthenticationStateRepository } from './authentication-state.repository';
import type { AuthenticationAdapters } from './authentication-boundaries';
import { createLocalAuthenticationAdapters } from './authentication-boundaries';
import { InMemoryConsumerAccountRepository } from './consumer-account.repository';

function createAuthService(
  wechat?: {
    code2session: (
      code: string,
    ) => Promise<{ openid: string; unionid?: string }>;
    getPhoneNumber: (code: string) => Promise<{ phoneNumber: string }>;
  },
  stores: {
    sessions?: InMemoryAuthenticationSessionRepository;
    consumerAccounts?: InMemoryConsumerAccountRepository;
  } = {},
) {
  const adapters: AuthenticationAdapters = {
    ...createLocalAuthenticationAdapters({
      verificationCode: '000000',
      secondFactorCode: '654321',
    }),
    ...(wechat
      ? {
          wechatCodeResolver: wechat,
          wechatPhoneNumberResolver: wechat,
        }
      : {}),
  };
  const sessions =
    stores.sessions ?? new InMemoryAuthenticationSessionRepository();
  const state = new InMemoryAuthenticationStateRepository();
  const consumerAccounts =
    stores.consumerAccounts ?? new InMemoryConsumerAccountRepository();
  return new AuthenticationService(
    adapters,
    sessions,
    state,
    consumerAccounts,
    {
      get: () => {
        throw new Error('parent binding lookup not needed in this spec');
      },
    } as never,
  );
}

describe('WeChat mini-program login (ADR-0006)', () => {
  const resolver = {
    // 真实语义：同一用户不同 code 换到同一个 openid
    code2session: () => Promise.resolve({ openid: 'openid-stable-user' }),
    getPhoneNumber: () => Promise.resolve({ phoneNumber: '13800138000' }),
  };

  it('issues a parent session from a wechat code without phone binding', async () => {
    const service = createAuthService(resolver);
    const session = await service.loginWechat('wx-code-1');
    expect(session.actor.kind).toBe('parent');
    expect(session.availableIdentities).toEqual(['parent']);
    expect(session.accessToken).toBeTruthy();
  });

  it('returns the same account for the same openid', async () => {
    const service = createAuthService(resolver);
    const first = await service.loginWechat('wx-code-1');
    const second = await service.loginWechat('wx-code-2');
    expect(second.actor.userAccountId).toBe(first.actor.userAccountId);
  });

  it('merges the wechat identity into an existing phone account on bind', async () => {
    const service = createAuthService(resolver);
    // 先有手机号 OTP 账号（线下已建立家庭绑定的家长）
    await service.requestParentOtp('13800138000');
    const otpSession = await service.verifyParentOtp('13800138000', '000000');
    const phoneAccountId = otpSession.actor.userAccountId;

    // 微信登录得到独立临时账号
    const wechatSession = await service.loginWechat('wx-bind-1');
    expect(wechatSession.actor.userAccountId).not.toBe(phoneAccountId);

    // 一键手机号授权 → 合并进既有手机号账号
    await service.bindWechatPhone(wechatSession.accessToken, 'phone-code-1');
    const merged = await service.loginWechat('wx-bind-1');
    expect(merged.actor.userAccountId).toBe(phoneAccountId);
  });

  it('keeps consumer accounts and profile ids across a service restart', async () => {
    const sessions = new InMemoryAuthenticationSessionRepository();
    const consumerAccounts = new InMemoryConsumerAccountRepository();
    const first = createAuthService(resolver, { sessions, consumerAccounts });
    const before = await first.loginWechat('wx-code-1');

    const restarted = createAuthService(resolver, {
      sessions,
      consumerAccounts,
    });
    const restored = await restarted.restore(before.accessToken);
    expect(restored.actor.userAccountId).toBe(before.actor.userAccountId);
    const again = await restarted.loginWechat('wx-code-2');
    expect(again.actor.userAccountId).toBe(before.actor.userAccountId);
    expect(before.actor.userAccountId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs a customer in with a platform-assigned account linked by phone', async () => {
    const service = createAuthService(resolver);
    await service.requestParentOtp('13700137000');
    const otp = await service.verifyParentOtp('13700137000', '000000');

    await expect(
      service.loginParentWithPassword('star_family', 'Abc12345'),
    ).rejects.toMatchObject({ status: 401 });
    await service.assignConsumerCredentials({
      phone: '13700137000',
      username: 'Star_Family',
      password: 'Abc12345',
    });
    const viaPassword = await service.loginParentWithPassword(
      'star_family',
      'Abc12345',
    );
    expect(viaPassword.actor.userAccountId).toBe(otp.actor.userAccountId);
    await expect(
      service.loginParentWithPassword('star_family', 'wrong-pass1'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.assignConsumerCredentials({
        phone: '13600136000',
        username: 'star_family',
        password: 'Abc12345',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await service.listAssignedConsumerAccounts()).map((a) => a.username),
    ).toEqual(['star_family']);
  });

  it('fails closed when the wechat resolver is missing', async () => {
    const service = createAuthService(undefined);
    await expect(service.loginWechat('wx-code-x')).rejects.toMatchObject({
      response: { code: 'WECHAT_NOT_CONFIGURED' },
    });
  });
});
