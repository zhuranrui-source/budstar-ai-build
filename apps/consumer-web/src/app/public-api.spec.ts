import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicAppointmentLead, listPublicCampuses } from './public-api';

const validLead = {
  parentName: '陈女士',
  phone: '13800138000',
  childAgeOrGrade: '小学四年级',
  interestedCourse: 'AI 体验课',
  campusId: 'shenzhen-nanshan',
  preferredContactTime: '工作日晚间',
};

describe('public API client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads and validates public campuses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ id: 'shenzhen-nanshan', name: '深圳南山校区' }]),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPublicCampuses()).resolves.toEqual([
      { id: 'shenzhen-nanshan', name: '深圳南山校区' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/public/campuses',
      { signal: undefined },
    );
  });

  it('sends the same explicit idempotency key with an appointment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'lead-1',
          status: 'PENDING_CONTACT',
          createdAt: '2026-07-14T00:00:00.000Z',
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createPublicAppointmentLead(validLead, 'appointment-retry-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/public/appointment-leads',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'appointment-retry-1',
        },
      }),
    );
  });
});
