import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  isGithubUrl,
  isHttpUrl,
  isMainlandPhone,
} from './format';

describe('format and input validation', () => {
  it('validates mainland phone numbers strictly', () => {
    expect(isMainlandPhone('13800138000')).toBe(true);
    expect(isMainlandPhone('23800138000')).toBe(false);
    expect(isMainlandPhone('1380013800')).toBe(false);
  });

  it('accepts only HTTP links and GitHub repositories where required', () => {
    expect(isHttpUrl('https://example.com/work')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isGithubUrl('https://github.com/budstar/project')).toBe(true);
    expect(isGithubUrl('https://github.com.evil.test/project')).toBe(false);
  });

  it('handles empty and invalid timestamps without throwing', () => {
    expect(formatDateTime(null)).toBe('刚刚');
    expect(formatDateTime('invalid')).toBe('时间未知');
  });
});
