import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import { listPlanetFeed, type PlanetPost } from '../../utils/family-api';
import Taro from '@tarojs/taro';

export default function PlanetPage() {
  const [posts, setPosts] = useState<PlanetPost[]>([]);
  const [error, setError] = useState('');
  const token = Taro.getStorageSync('accessToken') as string;

  useEffect(() => {
    if (!token) return;
    listPlanetFeed(token)
      .then(setPosts)
      .catch((c) => setError(c instanceof Error ? c.message : '加载失败'));
  }, [token]);

  return (
    <ScrollView scrollY className="page">
      <View className="section">
        <Text className="h1">星芽星球</Text>
        <Text className="sub">封闭社区 · 家庭可见</Text>
      </View>
      {error ? <Text className="err">{error}</Text> : null}
      {posts.length === 0 && !error ? (
        <Text className="muted">暂无可见内容。</Text>
      ) : null}
      {posts.map((p) => (
        <View key={p.id} className="card">
          <Text className="card-title">{p.title}</Text>
          <Text className="card-sub">
            {p.studentDisplayName} ·{' '}
            {p.visibilityScope === 'FAMILY'
              ? '家庭'
              : p.visibilityScope === 'CLASS'
                ? '班级'
                : '校区'}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
