import { describe, expect, it } from 'vitest';
import {
  appointmentLeadStatuses,
  canTransitionAppointmentLead,
  createAppointmentLeadSchema,
  publicCampusListSchema,
} from './appointment-lead';

describe('appointment lead contract', () => {
  it('publishes the complete CRM status vocabulary in order', () => {
    expect(appointmentLeadStatuses).toEqual([
      'PENDING_CONTACT',
      'CONTACTED',
      'APPOINTMENT_SCHEDULED',
      'VISITED',
      'ENROLLED',
      'CLOSED',
    ]);
  });

  it('accepts valid public appointment details', () => {
    expect(
      createAppointmentLeadSchema.safeParse({
        parentName: '陈女士',
        phone: '13800138000',
        childAgeOrGrade: '小学四年级',
        interestedCourse: 'Vibe Coding',
        campusId: 'shenzhen-nanshan',
        preferredContactTime: '工作日 18:00 后',
      }).success,
    ).toBe(true);
  });

  it('rejects unknown fields and malformed phone numbers', () => {
    expect(
      createAppointmentLeadSchema.safeParse({
        parentName: '陈女士',
        phone: '1234',
        childAgeOrGrade: '小学四年级',
        interestedCourse: 'Vibe Coding',
        campusId: 'shenzhen-nanshan',
        preferredContactTime: '工作日 18:00 后',
        role: 'platform-admin',
      }).success,
    ).toBe(false);
  });

  it('allows only the declared forward CRM transitions', () => {
    expect(canTransitionAppointmentLead('PENDING_CONTACT', 'CONTACTED')).toBe(
      true,
    );
    expect(canTransitionAppointmentLead('VISITED', 'ENROLLED')).toBe(true);
    expect(canTransitionAppointmentLead('CONTACTED', 'ENROLLED')).toBe(false);
    expect(canTransitionAppointmentLead('ENROLLED', 'CLOSED')).toBe(false);
  });

  it('allows CLOSED reopen to prior follow-up statuses only', () => {
    expect(canTransitionAppointmentLead('CLOSED', 'CONTACTED')).toBe(true);
    expect(canTransitionAppointmentLead('CLOSED', 'VISITED')).toBe(true);
    expect(canTransitionAppointmentLead('CLOSED', 'ENROLLED')).toBe(false);
    expect(canTransitionAppointmentLead('CLOSED', 'CLOSED')).toBe(false);
  });

  it('publishes only safe campus fields', () => {
    expect(
      publicCampusListSchema.safeParse([
        { id: 'shenzhen-nanshan', name: '深圳南山校区' },
      ]).success,
    ).toBe(true);
    expect(
      publicCampusListSchema.safeParse([
        {
          id: 'shenzhen-nanshan',
          name: '深圳南山校区',
          internalContact: '13800138000',
        },
      ]).success,
    ).toBe(false);
  });
});
