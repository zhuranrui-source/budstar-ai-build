import { describe, expect, it } from 'vitest';
import {
  canTransitionClassStatus,
  createClassSchema,
  updateClassSchema,
} from './class';

describe('class contract', () => {
  it('accepts class creation against a published version id', () => {
    expect(
      createClassSchema.safeParse({
        name: '南山种子一班',
        coursePackageVersionId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(true);
  });

  it('only allows Draft→Active→Closed transitions', () => {
    expect(canTransitionClassStatus('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionClassStatus('ACTIVE', 'CLOSED')).toBe(true);
    expect(canTransitionClassStatus('DRAFT', 'CLOSED')).toBe(false);
    expect(canTransitionClassStatus('CLOSED', 'ACTIVE')).toBe(false);
  });

  it('rejects empty updates', () => {
    expect(updateClassSchema.safeParse({}).success).toBe(false);
  });
});
