import {
  appointmentLeadCreatedSchema,
  publicCampusListSchema,
  type AppointmentLeadCreated,
  type CreateAppointmentLeadInput,
  type PublicCampus,
} from '@budstar/contracts';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export async function listPublicCampuses(
  signal?: AbortSignal,
): Promise<PublicCampus[]> {
  const response = await fetch(`${apiBaseUrl}/public/campuses`, { signal });
  if (!response.ok) {
    throw new Error('PUBLIC_CAMPUSES_UNAVAILABLE');
  }

  return publicCampusListSchema.parse(await response.json());
}

export async function createPublicAppointmentLead(
  input: CreateAppointmentLeadInput,
  idempotencyKey: string,
): Promise<AppointmentLeadCreated> {
  const response = await fetch(`${apiBaseUrl}/public/appointment-leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('APPOINTMENT_SUBMISSION_FAILED');
  }

  return appointmentLeadCreatedSchema.parse(await response.json());
}
