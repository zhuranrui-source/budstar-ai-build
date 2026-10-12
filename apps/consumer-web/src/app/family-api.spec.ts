import { describe, expect, it, vi } from 'vitest';
import { bindFamilyViewCode, listBoundStudents } from './family-api';

describe('family-api', () => {
  it('posts family view code bindings through the shared contract', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: '11111111-1111-4111-8111-111111111111',
        campusId: 'campus-a',
        parentProfileId: '22222222-2222-4222-8222-222222222222',
        studentProfileId: '33333333-3333-4333-8333-333333333333',
        studentDisplayName: '小星',
        status: 'ACTIVE',
        createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      }),
    );
    const result = await bindFamilyViewCode(
      'token',
      { familyViewCode: 'ABCD1234' },
      fetcher,
    );
    expect(result.status).toBe('ACTIVE');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/family/bindings'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads multi-child switcher payloads', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        students: [
          {
            studentProfileId: '33333333-3333-4333-8333-333333333333',
            displayName: '小星',
            campusId: 'campus-a',
            bindingId: '11111111-1111-4111-8111-111111111111',
          },
        ],
        selectedStudentProfileId: '33333333-3333-4333-8333-333333333333',
      }),
    );
    const result = await listBoundStudents('token', fetcher);
    expect(result.students).toHaveLength(1);
  });
});
