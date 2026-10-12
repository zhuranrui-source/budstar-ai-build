import type { Metadata } from 'next';

export const disallowedPublicRoutes = [
  '/planet',
  '/family',
  '/growth',
  '/learning',
] as const;

export const controlledRouteRobots: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  noarchive: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
};
