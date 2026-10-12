import { describe, expect, it } from 'vitest';
import robots from './robots';
import { controlledRouteRobots, disallowedPublicRoutes } from './route-policy';
import { metadata as planetMetadata } from './planet/page';

describe('controlled route indexing policy', () => {
  it('keeps the planet route out of search indexes', () => {
    expect(disallowedPublicRoutes).toContain('/planet');
    expect(controlledRouteRobots).toMatchObject({
      index: false,
      follow: false,
      noarchive: true,
    });
    expect(planetMetadata.robots).toEqual(controlledRouteRobots);
    expect(robots()).toMatchObject({
      rules: {
        userAgent: '*',
        allow: '/',
        disallow: expect.arrayContaining(['/planet']),
      },
    });
  });
});
