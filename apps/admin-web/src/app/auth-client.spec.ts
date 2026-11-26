import { describe, expect, it, vi } from 'vitest';
import {
  AdminApiClient,
  ForbiddenError,
  SessionExpiredError,
} from './auth-client';

const session = {
  accessToken: 'access-old',
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  actor: {
    kind: 'staff' as const,
    userAccountId: 'staff-local',
    displayName: '本地教务',
  },
  campuses: [
    {
      id: 'shenzhen-nanshan',
      name: '深圳南山校区',
      roles: ['TEACHER' as const, 'ACADEMIC_SERVICE' as const],
    },
  ],
};

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('AdminApiClient', () => {
  it('uses the real staff login and 2FA endpoints', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(session), { status: 201 }),
      );
    const client = new AdminApiClient(
      'http://localhost:3001/api',
      fetcher,
      storage(),
    );

    await client.login('staff', 'staff@local', 'Password123!');

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/api/auth/staff/login',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(client.readSession()?.actor.kind).toBe('staff');
  });

  it('refreshes once after 401 and retries with the rotated access token', async () => {
    const rotated = {
      ...session,
      accessToken: 'access-new',
    };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(rotated), { status: 201 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ campusId: 'shenzhen-nanshan' }), {
          status: 200,
        }),
      );
    const store = storage();
    store.setItem('budstar.admin.session', JSON.stringify(session));
    const client = new AdminApiClient(
      'http://localhost:3001/api',
      fetcher,
      store,
    );

    await client.getCampusOverview('shenzhen-nanshan');

    expect(fetcher).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/admin/overview',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-new',
          'X-Campus-Id': 'shenzhen-nanshan',
        }),
      }),
    );
  });

  it('clears local state when refresh is rejected', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const store = storage();
    store.setItem('budstar.admin.session', JSON.stringify(session));
    const client = new AdminApiClient(
      'http://localhost:3001/api',
      fetcher,
      store,
    );

    await expect(
      client.getCampusOverview('shenzhen-nanshan'),
    ).rejects.toBeInstanceOf(SessionExpiredError);
    expect(client.readSession()).toBeNull();
  });

  it('validates stored platform sessions against the API before restoring them', async () => {
    const platformSession = {
      ...session,
      actor: { ...session.actor, kind: 'platform-admin' as const },
      campuses: [],
    };
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(platformSession), { status: 200 }),
      );
    const store = storage();
    store.setItem('budstar.admin.session', JSON.stringify(platformSession));
    const client = new AdminApiClient(
      'http://localhost:3001/api',
      fetcher,
      store,
    );

    await expect(client.restoreSession()).resolves.toEqual(platformSession);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/session',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer access-old',
        }),
      }),
    );
  });

  it('keeps 403 distinct from expiry and clears locally when logout networking fails', async () => {
    const store = storage();
    store.setItem('budstar.admin.session', JSON.stringify(session));
    const deniedClient = new AdminApiClient(
      'http://localhost:3001/api',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: 'FORBIDDEN', message: '无权执行该操作' }),
            { status: 403 },
          ),
        ),
      store,
    );
    await expect(
      deniedClient.getCampusOverview('shenzhen-nanshan'),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(deniedClient.readSession()).not.toBeNull();

    const offlineClient = new AdminApiClient(
      'http://localhost:3001/api',
      vi.fn().mockRejectedValue(new Error('offline')),
      store,
    );
    await expect(offlineClient.logout()).resolves.toBeUndefined();
    expect(offlineClient.readSession()).toBeNull();
  });
});
