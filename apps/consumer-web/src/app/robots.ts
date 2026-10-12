import type { MetadataRoute } from 'next';
import { disallowedPublicRoutes } from './route-policy';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...disallowedPublicRoutes],
    },
  };
}
