import { Logger } from '@nestjs/common';
import { InMemoryAppointmentLeadRepository } from './appointment-lead.repository';
import { AppointmentLeadsService } from './appointment-leads.service';

describe('AppointmentLeadsService logging', () => {
  it('logs a created lead with a masked phone number only', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new AppointmentLeadsService(
      new InMemoryAppointmentLeadRepository(),
    );

    await service.create(
      {
        campusId: 'shenzhen-nanshan',
        parentName: '陈女士',
        phone: '13800138000',
        childAgeOrGrade: '四年级',
        interestedCourse: 'AI 体验课',
        preferredContactTime: '工作日晚间',
      },
      'logging-test-key',
    );

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'appointment_lead_created',
        campusId: 'shenzhen-nanshan',
        phone: '138****8000',
      }),
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain('13800138000');
    log.mockRestore();
  });
});
