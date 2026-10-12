import { describe, expect, it } from 'vitest';
import {
  PLATFORM_ENTITY_FIELDS,
  assertNoArbitrarySql,
  platformBrowsableEntities,
  platformDataBrowseQuerySchema,
} from './platform';

describe('platform contracts', () => {
  it('exposes a fixed entity whitelist without SQL surface', () => {
    expect(platformBrowsableEntities.length).toBeGreaterThan(0);
    expect(PLATFORM_ENTITY_FIELDS.appointment_lead).toContain('phoneMasked');
    const parsed = platformDataBrowseQuerySchema.safeParse({
      entity: 'campus',
      limit: 10,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects arbitrary SQL payloads', () => {
    expect(() => assertNoArbitrarySql({ q: 'SELECT * FROM users' })).toThrow(
      /Arbitrary SQL/,
    );
    expect(() => assertNoArbitrarySql({ entity: 'campus' })).not.toThrow();
  });
});
