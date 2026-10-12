import { resolveAppointmentLeadRepositoryMode } from './appointment-lead-repository.config';

describe('appointment lead repository configuration', () => {
  it('defaults to prisma in production', () => {
    expect(resolveAppointmentLeadRepositoryMode({}, 'production')).toBe(
      'prisma',
    );
  });

  it('defaults to memory for local and test environments', () => {
    expect(resolveAppointmentLeadRepositoryMode({}, 'test')).toBe('memory');
  });

  it('allows an explicit adapter and rejects unknown values', () => {
    expect(
      resolveAppointmentLeadRepositoryMode(
        { APPOINTMENT_LEAD_REPOSITORY: 'prisma' },
        'development',
      ),
    ).toBe('prisma');
    expect(() =>
      resolveAppointmentLeadRepositoryMode(
        { APPOINTMENT_LEAD_REPOSITORY: 'silent-memory' },
        'production',
      ),
    ).toThrow('Unsupported APPOINTMENT_LEAD_REPOSITORY');
  });

  it('refuses in-memory appointment persistence in production', () => {
    expect(() =>
      resolveAppointmentLeadRepositoryMode(
        { APPOINTMENT_LEAD_REPOSITORY: 'memory' },
        'production',
      ),
    ).toThrow('must not use memory in production');
  });
});
