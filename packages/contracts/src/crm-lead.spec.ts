import { describe, expect, it } from 'vitest';
import {
  requiresReopenReason,
  transitionAppointmentLeadSchema,
  updateAppointmentLeadSchema,
} from './crm-lead';

describe('crm lead contract', () => {
  it('requires reopen reason metadata for CLOSED reopen', () => {
    expect(requiresReopenReason('CLOSED', 'CONTACTED')).toBe(true);
    expect(requiresReopenReason('CONTACTED', 'CLOSED')).toBe(false);
    expect(
      transitionAppointmentLeadSchema.safeParse({
        toStatus: 'CONTACTED',
        reopenReason: '家长重新表达意向',
      }).success,
    ).toBe(true);
  });

  it('allows assignee and note updates', () => {
    expect(
      updateAppointmentLeadSchema.safeParse({
        assigneeAccountId: '11111111-1111-4111-8111-111111111111',
        note: '已电话沟通',
      }).success,
    ).toBe(true);
    expect(updateAppointmentLeadSchema.safeParse({}).success).toBe(false);
  });
});
