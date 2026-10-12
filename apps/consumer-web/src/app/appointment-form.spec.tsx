// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppointmentForm } from './appointment-form';
import { createPublicAppointmentLead, listPublicCampuses } from './public-api';

vi.mock('./public-api', () => ({
  createPublicAppointmentLead: vi.fn(),
  listPublicCampuses: vi.fn(),
}));

const listCampusesMock = vi.mocked(listPublicCampuses);
const createLeadMock = vi.mocked(createPublicAppointmentLead);

describe('AppointmentForm', () => {
  beforeEach(() => {
    listCampusesMock.mockResolvedValue([
      { id: 'shenzhen-nanshan', name: '深圳南山校区' },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders campus state and preserves entered values after submission failure', async () => {
    createLeadMock.mockRejectedValue(new Error('offline'));
    render(<AppointmentForm />);

    expect(
      (screen.getByLabelText('意向校区') as HTMLSelectElement).disabled,
    ).toBe(true);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('意向校区') as HTMLSelectElement).disabled,
      ).toBe(false),
    );

    fireEvent.change(screen.getByLabelText('家长称呼'), {
      target: { value: '陈女士' },
    });
    fireEvent.change(screen.getByLabelText('联系手机'), {
      target: { value: '13800138000' },
    });
    fireEvent.change(screen.getByLabelText('孩子年龄或年级'), {
      target: { value: '四年级' },
    });
    fireEvent.change(screen.getByLabelText('感兴趣的课程'), {
      target: { value: 'AI 体验课' },
    });
    fireEvent.change(screen.getByLabelText('意向校区'), {
      target: { value: 'shenzhen-nanshan' },
    });
    fireEvent.change(screen.getByLabelText('方便联系时间'), {
      target: { value: '工作日晚间' },
    });
    fireEvent.submit(screen.getByRole('button', { name: '提交预约' }));

    expect(await screen.findByText(/你填写的内容仍保留在页面中/)).toBeTruthy();
    expect((screen.getByLabelText('家长称呼') as HTMLInputElement).value).toBe(
      '陈女士',
    );
    expect((screen.getByLabelText('联系手机') as HTMLInputElement).value).toBe(
      '13800138000',
    );
  });

  it('shows submitting and success states and clears the form on success', async () => {
    let resolveSubmission!: () => void;
    createLeadMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmission = () =>
          resolve({
            id: 'lead-1',
            status: 'PENDING_CONTACT',
            createdAt: '2026-07-14T00:00:00.000Z',
          });
      }),
    );
    render(<AppointmentForm />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText('意向校区') as HTMLSelectElement).disabled,
      ).toBe(false),
    );

    const values: Record<string, string> = {
      parentName: '陈女士',
      phone: '13800138000',
      childAgeOrGrade: '四年级',
      interestedCourse: 'AI 体验课',
      campusId: 'shenzhen-nanshan',
      preferredContactTime: '工作日晚间',
    };
    for (const [name, value] of Object.entries(values)) {
      fireEvent.change(document.querySelector(`[name="${name}"]`)!, {
        target: { value },
      });
    }
    fireEvent.submit(screen.getByRole('button', { name: '提交预约' }));

    expect(
      (
        screen.getByRole('button', {
          name: '正在提交…',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    resolveSubmission();
    expect(await screen.findByText(/预约已提交/)).toBeTruthy();
    expect((screen.getByLabelText('家长称呼') as HTMLInputElement).value).toBe(
      '',
    );
  });
});
