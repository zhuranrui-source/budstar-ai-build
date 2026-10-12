import type { Metadata } from 'next';
import { controlledRouteRobots } from '../route-policy';
import PlanetFeedPage from './planet-feed';

export const metadata: Metadata = {
  title: '星芽星球｜受控家庭入口',
  description: '星芽星球仅面向已授权家庭和教学组织开放。',
  robots: controlledRouteRobots,
};

export default function PlanetEntry() {
  return <PlanetFeedPage />;
}
