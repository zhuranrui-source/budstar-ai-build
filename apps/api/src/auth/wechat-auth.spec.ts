import { AuthenticationService } from './authentication.service';
import { InMemoryAuthenticationSessionRepository } from './authentication-session.repository';
import { InMemoryAuthenticationStateRepository } from './authentication-state.repository';
import type { AuthenticationAdapters } from './authentication-boundaries';
import { createLocalAuthenticationAdapters } from './authentication-boundaries';

function createAuthService(wechat?: {
  code2session: (code: string) => Promise<{ openid: string; unionid?: string }>;
  getPhoneNumber: (code: string) => Promise<{ phoneNumber: string }>;
}) {
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
  const sessions = new InMemoryAuthenticationSessionRepository();
  const state = new InMemoryAuthenticationStateRepository();
  return new AuthenticationService(adapters, sessions, state, {
    get: () => {
      throw new Error('parent binding lookup not needed in this spec');
    },
  } as never);
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

  it('fails closed when the wechat resolver is missing', async () => {
    const service = createAuthService(undefined);
    await expect(service.loginWechat('wx-code-x')).rejects.toMatchObject({
      response: { code: 'WECHAT_NOT_CONFIGURED' },
    });
  });
});
