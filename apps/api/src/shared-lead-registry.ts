/**
 * 本地开发共享内存注册表：公开建线索（appointment-leads）与 CRM 管理（crm）
 * 在 Prisma 模式下天然同库；内存模式下经由这个单例保持一致。
 */
export const sharedLeadRecords = new Map<string, unknown>();

/** 测试隔离：每个用例前清空共享注册表。 */
export function resetSharedLeadRecords(): void {
  sharedLeadRecords.clear();
}
