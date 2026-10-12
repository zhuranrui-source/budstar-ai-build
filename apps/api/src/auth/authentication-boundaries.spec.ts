import {
  createLocalAuthenticationAdapters,
  resolveAuthenticationAdapters,
} from './authentication-boundaries';

describe('authentication adapter boundaries', () => {
  it('fails closed in production when real adapters are not configured', () => {
    expect(() =>
      resolveAuthenticationAdapters({
        nodeEnv: 'production',
        verificationAdapter: undefined,
      }),
    ).toThrow('Production verification adapters are not configured');
  });

  it('provides explicit local-only adapters outside production', async () => {
    const adapters = createLocalAuthenticationAdapters({
      verificationCode: '123456',
      secondFactorCode: '654321',
    });

    await expect(
      adapters.verificationCodeSender.send('+8613800138000', '123456'),
    ).resolves.toBeUndefined();
    await expect(
      adapters.verificationCodeStore.issue(
        '+8613800138000',
        '123456',
        new Date(Date.now() + 1_000),
      ),
    ).resolves.toBeUndefined();
    await expect(
      adapters.verificationCodeStore.consume(
        '+8613800138000',
        '123456',
        new Date(),
      ),
    ).resolves.toBe(true);
    await expect(
      adapters.verificationCodeStore.consume(
        '+8613800138000',
        '123456',
        new Date(),
      ),
    ).resolves.toBe(false);
    await expect(
      adapters.secondFactorVerifier.verify('staff-1', '654321'),
    ).resolves.toBe(true);
    await expect(
      adapters.secondFactorVerifier.verify('staff-1', 'wrong'),
    ).resolves.toBe(false);
  });
});
