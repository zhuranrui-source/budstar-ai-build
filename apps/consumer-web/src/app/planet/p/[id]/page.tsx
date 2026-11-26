import type { Metadata } from 'next';
import type { PlanetPostDetailView } from '@budstar/contracts';
import { controlledRouteRobots } from '../../../route-policy';
import PlanetFeedPage from '../../planet-feed';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
const MEDIA_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

async function loadPost(id: string): Promise<PlanetPostDetailView | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/public/planet/posts/${encodeURIComponent(id)}`,
      { next: { revalidate: 60 } },
    );
    return response.ok
      ? ((await response.json()) as PlanetPostDetailView)
      : null;
  } catch {
    return null;
  }
}

/** 分享链接：带标题、摘要和封面图，粘贴到支持链接预览的应用里会显示卡片。 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const post = await loadPost((await params).id);
  if (!post) return { title: '星芽星球', robots: controlledRouteRobots };
  const title = `${post.studentLabel ? `${post.studentLabel}的` : ''}${post.title}｜星芽星球`;
  const description = post.body.slice(0, 80) || '来看看星芽孩子们的作品';
  const images = post.imageUrls[0]
    ? [`${MEDIA_ORIGIN}${post.imageUrls[0]}`]
    : [];
  return {
    title,
    description,
    robots: controlledRouteRobots,
    openGraph: { title, description, images, type: 'article' },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title,
      description,
      images,
    },
  };
}

export default async function SharedPlanetPost({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PlanetFeedPage initialPostId={(await params).id} />;
}
