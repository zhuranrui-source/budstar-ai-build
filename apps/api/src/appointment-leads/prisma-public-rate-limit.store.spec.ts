import { PrismaPublicRateLimitStore } from './prisma-public-rate-limit.store';

describe('PrismaPublicRateLimitStore', () => {
  it('retries a transient serializable transaction conflict', async () => {
    const bucket = {
      keyHash: 'a'.repeat(64),
      count: 1,
      resetAt: new Date(61_000),
    };
    const transactionClient = {
      publicRateLimitBucket: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(bucket),
        update: jest.fn(),
      },
    };
    const transaction = jest
      .fn()
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(
        (operation: (client: typeof transactionClient) => Promise<unknown>) =>
          operation(transactionClient),
      );
    const store = new PrismaPublicRateLimitStore({
      client: { $transaction: transaction },
    } as never);

    await expect(
      store.consume(bucket.keyHash, 1_000, 60_000, 5),
    ).resolves.toEqual({
      count: 1,
      resetAt: 61_000,
      allowed: true,
    });
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});
