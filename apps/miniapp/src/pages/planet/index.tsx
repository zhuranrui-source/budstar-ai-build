import { useCallback, useRef, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classroomCover from '../../assets/content/community-classroom.jpg';
import noiseCover from '../../assets/content/community-noise-poster.jpg';
import PageState from '../../components/PageState';
import { formatDateTime } from '../../utils/format';
import { listPlanetFeed, type PlanetPost } from '../../utils/family-api';
import { PREVIEW_MODE } from '../../utils/preview';
import LoginRequired from '../../components/LoginRequired';
import { getValidSession } from '../../utils/session';
import './index.css';

const VISIBILITY: Record<string, string> = {
  FAMILY: '家庭可见',
  CLASS: '班级分享',
  CAMPUS: '校区动态',
};

const FILTERS = [
  { value: 'ALL', label: '全部' },
  { value: 'FAMILY', label: '仅家庭' },
  { value: 'CLASS', label: '班级可见' },
  { value: 'CAMPUS', label: '校区可见' },
] as const;

type PlanetFilter = (typeof FILTERS)[number]['value'];

export default function PlanetPage() {
  const [posts, setPosts] = useState<PlanetPost[]>([]);
  const [filter, setFilter] = useState<PlanetFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const requestSequence = useRef(0);

  const loadPosts = useCallback(async (showLoading = true): Promise<void> => {
    const session = getValidSession();
    setNeedsLogin(!session);
    if (!session) {
      setLoading(false);
      return;
    }
    const sequence = ++requestSequence.current;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const nextPosts = await listPlanetFeed(session.accessToken);
      if (sequence === requestSequence.current) setPosts(nextPosts);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setPosts([]);
      setError(caught instanceof Error ? caught.message : '动态加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useDidShow(() => {
    void loadPosts();
  });

  usePullDownRefresh(() => {
    void loadPosts(false).finally(() => Taro.stopPullDownRefresh());
  });

  const visiblePosts =
    filter === 'ALL'
      ? posts
      : posts.filter((post) => post.visibilityScope === filter);

  return (
    <View className="page tab-page planet-page">
      <View className="portal-page-head planet-head">
        <Text className="portal-kicker">BUDSTAR PLANET</Text>
        <Text className="portal-title">星球动态</Text>
        <Text className="portal-description">
          老师动态、课堂分享和孩子作品，都在这个封闭社区里。
        </Text>
        <View className="planet-filter">
          {FILTERS.map((item) => (
            <Button
              key={item.value}
              className={`planet-filter-button ${filter === item.value ? 'is-active' : ''}`}
              size="mini"
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </View>
      </View>

      {needsLogin ? (
        <LoginRequired description="星球是班级内的封闭社区，登录后可查看老师动态和孩子作品。" />
      ) : loading ? (
        <PageState kind="loading" title="正在加载作品动态" />
      ) : error ? (
        <PageState
          kind="error"
          title="作品动态加载失败"
          description={error}
          actionText="重新加载"
          onAction={() => void loadPosts()}
        />
      ) : visiblePosts.length === 0 ? (
        <PageState
          kind="empty"
          title="这个分类还没有内容"
          description="切换其他分类看看，或下拉页面刷新。"
        />
      ) : (
        <View className="planet-waterfall">
          {visiblePosts.map((post, index) => (
            <View
              key={post.id}
              className={`planet-card ${index % 3 === 1 ? 'planet-card--tall' : ''}`}
            >
              <View className="planet-media">
                {PREVIEW_MODE ? (
                  <Image
                    className="planet-image"
                    src={index % 2 === 0 ? noiseCover : classroomCover}
                    mode="aspectFill"
                  />
                ) : (
                  <View className={`planet-cover planet-cover--${index % 4}`}>
                    <Text>{post.title.slice(0, 1)}</Text>
                  </View>
                )}
                <Text className="planet-channel-tag">
                  {VISIBILITY[post.visibilityScope] ?? '成员可见'}
                </Text>
              </View>
              <View className="planet-copy">
                <Text className="planet-title">{post.title}</Text>
                <Text className="planet-summary">{post.body}</Text>
                <View className="planet-author">
                  <View className="planet-avatar">
                    {post.studentDisplayName.slice(0, 1)}
                  </View>
                  <View className="planet-author-copy">
                    <Text>{post.studentDisplayName}</Text>
                    <Text>{formatDateTime(post.publishedAt)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
