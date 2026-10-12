import { describe, expect, it } from 'vitest';
import { adminSessionRedirect } from './session-routing';

describe('admin session routing', () => {
  it('redirects expired or logged-out workspaces to login', () => {
    expect(adminSessionRedirect(false, false)).toBe('/login');
  });

  it('redirects a verified session away from the login page', () => {
    expect(adminSessionRedirect(true, true)).toBe('/');
  });

  it('does not redirect valid route/session combinations', () => {
    expect(adminSessionRedirect(true, false)).toBeNull();
    expect(adminSessionRedirect(false, true)).toBeNull();
  });
});
