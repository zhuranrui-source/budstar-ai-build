import { resolveTrustProxyHops } from './app.setup';

describe('application proxy configuration', () => {
  it('does not trust forwarded addresses by default', () => {
    expect(resolveTrustProxyHops({})).toBe(0);
  });

  it('accepts an explicit bounded proxy hop count', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '1' })).toBe(1);
    expect(() => resolveTrustProxyHops({ TRUST_PROXY_HOPS: 'all' })).toThrow(
      'TRUST_PROXY_HOPS',
    );
    expect(() =>
      resolveTrustProxyHops({ TRUST_PROXY_HOPS: '2' }, 'production'),
    ).toThrow('at most 1');
  });
});
