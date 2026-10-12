import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/database/prisma.service';
import { PrismaAuthenticationSessionRepository } from '../src/auth/authentication-session.repository';
import { PrismaAuthenticationStateRepository } from '../src/auth/authentication-state.repository';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('Prisma authentication sessions (integration)', () => {
  let firstPrisma: PrismaService;
  let secondPrisma: PrismaService;
  let accountId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    firstPrisma = new PrismaService();
    secondPrisma = new PrismaService();
    accountId = randomUUID();
    await firstPrisma.client.userAccount.create({
      data: {
        id: accountId,
        kind: 'STAFF',
        loginIdentifier: `integration-${accountId}`,
      },
    });
  });

  afterAll(async () => {
    await firstPrisma.client.userAccount.deleteMany({
      where: { id: accountId },
    });
    await firstPrisma.onModuleDestroy();
    await secondPrisma.onModuleDestroy();
  });

  it('allows one cross-instance rotation and revokes the winner after replay', async () => {
    const first = new PrismaAuthenticationSessionRepository(firstPrisma);
    const second = new PrismaAuthenticationSessionRepository(secondPrisma);
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const originalHash = 'a'.repeat(64);
    const now = new Date();
    await first.create({
      sessionId,
      familyId,
      accountId,
      tokenHash: originalHash,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    const results = await Promise.all([
      first.rotate(
        originalHash,
        {
          id: randomUUID(),
          tokenHash: 'b'.repeat(64),
          expiresAt: new Date(now.getTime() + 120_000),
        },
        now,
      ),
      second.rotate(
        originalHash,
        {
          id: randomUUID(),
          tokenHash: 'c'.repeat(64),
          expiresAt: new Date(now.getTime() + 120_000),
        },
        now,
      ),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'reused',
      'rotated',
    ]);
    await expect(first.isActive(sessionId, accountId, now)).resolves.toBe(
      false,
    );
  });

  it('treats an expired replaced token as replay and revokes valid descendants', async () => {
    const repository = new PrismaAuthenticationSessionRepository(firstPrisma);
    const sessionId = randomUUID();
    const originalHash = 'd'.repeat(64);
    const descendantHash = 'e'.repeat(64);
    const issuedAt = new Date();
    await repository.create({
      sessionId,
      familyId: randomUUID(),
      accountId,
      tokenHash: originalHash,
      expiresAt: new Date(issuedAt.getTime() + 1_000),
    });
    await expect(
      repository.rotate(
        originalHash,
        {
          id: randomUUID(),
          tokenHash: descendantHash,
          expiresAt: new Date(issuedAt.getTime() + 120_000),
        },
        issuedAt,
      ),
    ).resolves.toMatchObject({ status: 'rotated' });

    await expect(
      repository.rotate(
        originalHash,
        {
          id: randomUUID(),
          tokenHash: 'f'.repeat(64),
          expiresAt: new Date(issuedAt.getTime() + 180_000),
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

  it('shares challenge attempts and login rate limits across instances', async () => {
    const first = new PrismaAuthenticationStateRepository(firstPrisma);
    const second = new PrismaAuthenticationStateRepository(secondPrisma);
    const suffix = randomUUID().replaceAll('-', '');
    const rateKey = suffix.padEnd(64, '0').slice(0, 64);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        (attempt % 2 === 0 ? first : second).consumeRateLimit(
          rateKey,
          new Date(),
          60_000,
          5,
        ),
      ).resolves.toBe(true);
    }
    await expect(
      second.consumeRateLimit(rateKey, new Date(), 60_000, 5),
    ).resolves.toBe(false);

    const challengeHash = `${suffix}${suffix}`.slice(0, 64);
    await first.createChallenge({
      tokenHash: challengeHash,
      accountId,
      intendedKind: 'staff',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      second.attemptChallenge(challengeHash, 'staff', new Date(), 5),
    ).resolves.toEqual({ status: 'valid', accountId });
    await second.completeChallenge(challengeHash);
    await expect(
      first.attemptChallenge(challengeHash, 'staff', new Date(), 5),
    ).resolves.toEqual({ status: 'invalid' });
  });
});
