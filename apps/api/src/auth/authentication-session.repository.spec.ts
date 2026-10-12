import { randomUUID } from 'node:crypto';
import { InMemoryAuthenticationSessionRepository } from './authentication-session.repository';

describe('authentication session repository', () => {
  it('revokes valid descendants when an expired replaced token is replayed', async () => {
    const repository = new InMemoryAuthenticationSessionRepository();
    const issuedAt = new Date();
    const sessionId = randomUUID();
    const accountId = randomUUID();
    await repository.create({
      sessionId,
      familyId: randomUUID(),
      accountId,
      tokenHash: 'old',
      expiresAt: new Date(issuedAt.getTime() + 1_000),
    });
    await repository.rotate(
      'old',
      {
        id: randomUUID(),
        tokenHash: 'current',
        expiresAt: new Date(issuedAt.getTime() + 60_000),
      },
      issuedAt,
    );

    await expect(
      repository.rotate(
        'old',
        {
          id: randomUUID(),
          tokenHash: 'attacker',
          expiresAt: new Date(issuedAt.getTime() + 60_000),
        },
        new Date(issuedAt.getTime() + 2_000),
      ),
    ).resolves.toEqual({ status: 'reused' });
    await expect(
      repository.isActive(
        sessionId,
        accountId,
        new Date(issuedAt.getTime() + 2_000),
      ),
    ).resolves.toBe(false);
  });
});
