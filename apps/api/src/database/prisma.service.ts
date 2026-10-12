import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private clientInstance?: PrismaClient;

  get client(): PrismaClient {
    if (this.clientInstance) {
      return this.clientInstance;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for Prisma persistence');
    }

    this.clientInstance = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    return this.clientInstance;
  }

  async onModuleDestroy(): Promise<void> {
    await this.clientInstance?.$disconnect();
  }
}
