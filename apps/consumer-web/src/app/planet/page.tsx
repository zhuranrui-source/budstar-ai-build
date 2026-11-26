import type { Metadata } from 'next';
import { controlledRouteRobots } from '../route-policy';
import PlanetFeedPage from './planet-feed';

export const metadata: Metadata = {
  title: '星芽星球｜作品、竞赛与星芽故事',
  description: '孩子们的课堂作品、竞赛成果，以及星芽的课程与文化。',
  robots: controlledRouteRobots,
};

export default function PlanetEntry() {
  return <PlanetFeedPage />;
}
