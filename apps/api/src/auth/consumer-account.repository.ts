import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export const CONSUMER_ACCOUNT_REPOSITORY = Symbol(
  'CONSUMER_ACCOUNT_REPOSITORY',
);

/**
 * 消费端（家长）账号持久化记录。
 * 手机号与微信 openid 只以 HMAC 摘要存储（loginIdentifier = phone:<hash> / wechat:<hash>）。
 */
export type ConsumerAccountRecord = {
  id: string;
  loginIdentifier: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  parentProfileId: string;
  wechatOpenidHash: string | null;
  username: string | null;
  passwordHash: string | null;
};

export type AssignedConsumerAccount = {
  id: string;
  username: string;
  updatedAt: Date;
};

export type CreateConsumerAccountInput = {
  loginIdentifier: string;
  displayName: string;
  wechatOpenidHash?: string;
};

export interface ConsumerAccountRepository {
  findById(id: string): Promise<ConsumerAccountRecord | null>;
  findByLoginIdentifier(
    loginIdentifier: string,
  ): Promise<ConsumerAccountRecord | null>;
  findByWechatOpenidHash(hash: string): Promise<ConsumerAccountRecord | null>;
  create(input: CreateConsumerAccountInput): Promise<ConsumerAccountRecord>;
  /** 把微信身份转移到目标账号（同一 openid 只能挂在一个账号上）。 */
  linkWechat(accountId: string, wechatOpenidHash: string): Promise<void>;
  findByUsername(username: string): Promise<ConsumerAccountRecord | null>;
  /** 平台统一分配：设置账号名与密码哈希。 */
  assignCredentials(
    accountId: string,
    username: string,
    passwordHash: string,
  ): Promise<void>;
  listAssigned(): Promise<AssignedConsumerAccount[]>;
}

/** 未建家长档案前使用的稳定档案 ID（由账号 ID 确定性派生，重启不变）。 */
export function derivedParentProfileId(accountId: string): string {
  const hex = createHash('sha256')
    .update(`parent-profile:${accountId}`)
    .digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

@Injectable()
export class InMemoryConsumerAccountRepository implements ConsumerAccountRepository {
  private readonly records = new Map<string, ConsumerAccountRecord>();
  private readonly updatedAt = new Map<string, Date>();

  findById(id: string): Promise<ConsumerAccountRecord | null> {
    return Promise.resolve(this.copy(this.records.get(id)));
  }

  findByLoginIdentifier(
    loginIdentifier: string,
  ): Promise<ConsumerAccountRecord | null> {
    return Promise.resolve(
      this.copy(
        [...this.records.values()].find(
          (record) => record.loginIdentifier === loginIdentifier,
        ),
      ),
    );
  }

  findByWechatOpenidHash(hash: string): Promise<ConsumerAccountRecord | null> {
    return Promise.resolve(
      this.copy(
        [...this.records.values()].find(
          (record) => record.wechatOpenidHash === hash,
        ),
      ),
    );
  }

  create(input: CreateConsumerAccountInput): Promise<ConsumerAccountRecord> {
    const id = randomUUID();
    const record: ConsumerAccountRecord = {
      id,
      loginIdentifier: input.loginIdentifier,
      displayName: input.displayName,
      status: 'ACTIVE',
      parentProfileId: derivedParentProfileId(id),
      wechatOpenidHash: input.wechatOpenidHash ?? null,
      username: null,
      passwordHash: null,
    };
    this.records.set(id, record);
    return Promise.resolve({ ...record });
  }

  linkWechat(accountId: string, wechatOpenidHash: string): Promise<void> {
    for (const record of this.records.values()) {
      if (record.wechatOpenidHash === wechatOpenidHash) {
        record.wechatOpenidHash = null;
      }
    }
    const target = this.records.get(accountId);
    if (target) target.wechatOpenidHash = wechatOpenidHash;
    return Promise.resolve();
  }

  findByUsername(username: string): Promise<ConsumerAccountRecord | null> {
    return Promise.resolve(
      this.copy(
        [...this.records.values()].find(
          (record) => record.username === username,
        ),
      ),
    );
  }

  assignCredentials(
    accountId: string,
    username: string,
    passwordHash: string,
  ): Promise<void> {
    const target = this.records.get(accountId);
    if (target) {
      target.username = username;
      target.passwordHash = passwordHash;
      this.updatedAt.set(accountId, new Date());
    }
    return Promise.resolve();
  }

  listAssigned(): Promise<AssignedConsumerAccount[]> {
    return Promise.resolve(
      [...this.records.values()]
        .filter((record) => record.username)
        .map((record) => ({
          id: record.id,
          username: record.username!,
          updatedAt: this.updatedAt.get(record.id) ?? new Date(0),
        })),
    );
  }

  private copy(
    record: ConsumerAccountRecord | undefined,
  ): ConsumerAccountRecord | null {
    return record ? { ...record } : null;
  }
}

type UserAccountRow = {
  id: string;
  loginIdentifier: string;
  status: 'ACTIVE' | 'SUSPENDED';
  credentialHash: string | null;
  wechatOpenidHash: string | null;
  username: string | null;
  parentProfiles: Array<{ id: string; displayName: string }>;
};

@Injectable()
export class PrismaConsumerAccountRepository implements ConsumerAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  private readonly select = {
    id: true,
    loginIdentifier: true,
    status: true,
    credentialHash: true,
    wechatOpenidHash: true,
    username: true,
    parentProfiles: {
      select: { id: true, displayName: true },
      orderBy: { createdAt: 'asc' as const },
      take: 1,
    },
  };

  async findById(id: string): Promise<ConsumerAccountRecord | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const row = await this.prisma.client.userAccount.findFirst({
      where: { id, kind: 'PARENT' },
      select: this.select,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByLoginIdentifier(
    loginIdentifier: string,
  ): Promise<ConsumerAccountRecord | null> {
    const row = await this.prisma.client.userAccount.findFirst({
      where: { loginIdentifier, kind: 'PARENT' },
      select: this.select,
    });
    return row ? this.toRecord(row) : null;
  }

  async findByWechatOpenidHash(
    hash: string,
  ): Promise<ConsumerAccountRecord | null> {
    const row = await this.prisma.client.userAccount.findFirst({
      where: { wechatOpenidHash: hash, kind: 'PARENT' },
      select: this.select,
    });
    return row ? this.toRecord(row) : null;
  }

  async create(
    input: CreateConsumerAccountInput,
  ): Promise<ConsumerAccountRecord> {
    const row = await this.prisma.client.userAccount.upsert({
      where: { loginIdentifier: input.loginIdentifier },
      create: {
        kind: 'PARENT',
        loginIdentifier: input.loginIdentifier,
        wechatOpenidHash: input.wechatOpenidHash ?? null,
      },
      update: {},
      select: this.select,
    });
    return this.toRecord(row, input.displayName);
  }

  async linkWechat(accountId: string, wechatOpenidHash: string): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.userAccount.updateMany({
        where: { wechatOpenidHash, NOT: { id: accountId } },
        data: { wechatOpenidHash: null },
      }),
      this.prisma.client.userAccount.update({
        where: { id: accountId },
        data: { wechatOpenidHash },
      }),
    ]);
  }

  async findByUsername(
    username: string,
  ): Promise<ConsumerAccountRecord | null> {
    const row = await this.prisma.client.userAccount.findFirst({
      where: { username, kind: 'PARENT' },
      select: this.select,
    });
    return row ? this.toRecord(row) : null;
  }

  async assignCredentials(
    accountId: string,
    username: string,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.client.userAccount.update({
      where: { id: accountId },
      data: { username, credentialHash: passwordHash },
    });
  }

  async listAssigned(): Promise<AssignedConsumerAccount[]> {
    const rows = await this.prisma.client.userAccount.findMany({
      where: { kind: 'PARENT', username: { not: null } },
      select: { id: true, username: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 500,
    });
    return rows.map((row) => ({
      id: row.id,
      username: row.username!,
      updatedAt: row.updatedAt,
    }));
  }

  private toRecord(
    row: UserAccountRow,
    fallbackDisplayName?: string,
  ): ConsumerAccountRecord {
    const profile = row.parentProfiles[0];
    return {
      id: row.id,
      loginIdentifier: row.loginIdentifier,
      displayName:
        profile?.displayName ??
        fallbackDisplayName ??
        (row.loginIdentifier.startsWith('wechat:') ? '微信用户' : '家长用户'),
      status: row.status,
      parentProfileId: profile?.id ?? derivedParentProfileId(row.id),
      wechatOpenidHash: row.wechatOpenidHash,
      username: row.username,
      passwordHash: row.credentialHash,
    };
  }
}
