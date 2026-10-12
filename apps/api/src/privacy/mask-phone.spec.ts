import { maskPhone } from './mask-phone';

describe('maskPhone', () => {
  it.each([
    ['13800138000', '138****8000'],
    [' 13800138000 ', '138****8000'],
    ['123456', '***'],
    ['', '***'],
  ])('masks %p without exposing the complete value', (phone, expected) => {
    const masked = maskPhone(phone);

    expect(masked).toBe(expected);
    expect(masked).not.toBe(phone.trim());
  });
});
