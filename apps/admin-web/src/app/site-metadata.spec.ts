import { describe, expect, it } from 'vitest';
import { siteMetadata } from './site-metadata';

describe('admin site metadata', () => {
  it('identifies the staff application and blocks public indexing', () => {
    expect(siteMetadata.title).toContain('机构后台');
    expect(siteMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
