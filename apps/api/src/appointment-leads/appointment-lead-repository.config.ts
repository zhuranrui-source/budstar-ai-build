export type AppointmentLeadRepositoryMode = 'memory' | 'prisma';

export function resolveAppointmentLeadRepositoryMode(
  environment: Record<string, string | undefined>,
  nodeEnv = environment.NODE_ENV,
): AppointmentLeadRepositoryMode {
  const configured = environment.APPOINTMENT_LEAD_REPOSITORY;

  if (configured === 'memory' && nodeEnv === 'production') {
    throw new Error(
      'APPOINTMENT_LEAD_REPOSITORY must not use memory in production',
    );
  }
  if (configured === 'memory' || configured === 'prisma') {
    return configured;
  }

  if (configured) {
    throw new Error(`Unsupported APPOINTMENT_LEAD_REPOSITORY: ${configured}`);
  }

  return nodeEnv === 'production' ? 'prisma' : 'memory';
}
