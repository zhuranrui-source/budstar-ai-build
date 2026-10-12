import { describe, expect, it } from 'vitest';
import {
  campusContextSchema,
  parentOtpVerifySchema,
  passwordLoginSchema,
  secondFactorSchema,
} from './auth';

describe('authentication contracts', () => {
  it('accepts the supported credential and campus context payloads', () => {
    expect(
      parentOtpVerifySchema.parse({ phone: '13800138000', code: '000000' }),
    ).toEqual({ phone: '13800138000', code: '000000' });
    expect(
      passwordLoginSchema.parse({
        loginIdentifier: 'staff@local',
        password: 'Password123!',
      }),
    ).toBeTruthy();
    expect(
      secondFactorSchema.parse({
        challengeToken: 'challenge',
        code: '000000',
      }),
    ).toBeTruthy();
    expect(campusContextSchema.parse({ campusId: 'shenzhen-nanshan' })).toEqual(
      {
        campusId: 'shenzhen-nanshan',
      },
    );
  });

  it('rejects malformed secrets and identifiers at the shared boundary', () => {
    expect(() =>
      parentOtpVerifySchema.parse({ phone: '13800138000', code: '123' }),
    ).toThrow();
    expect(() =>
      passwordLoginSchema.parse({
        loginIdentifier: 'x',
        password: 'short',
      }),
    ).toThrow();
  });
});
