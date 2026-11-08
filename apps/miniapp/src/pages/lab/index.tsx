import { useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  listPublishedSubjectCourses,
  type SubjectCourseSummary,
} from '../../utils/family-api';

const SUBJECT: Record<string, string> = {
  MATH: '数学',
  CHINESE: '语文',
  ENGLISH: '英语',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
  BIOLOGY: '生物',
  OTHER: '其他',
};

export default function LabPage() {
  const [courses, setCourses] = useState<SubjectCourseSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    // 学科内容需要登录（ADR-0006）；无 token 时空列表
    const token = Taro.getStorageSync('accessToken') as string;
    if (!token) {
      setCourses([]);
      return;
    }
    listPublishedSubjectCourses(token)
      .then(setCourses)
      .catch((c) => setError(c instanceof Error ? c.message : '加载失败'));
  }, []);

  return (
    <ScrollView scrollY className="page">
      <View className="section">
        <Text className="h1">学科实验室</Text>
        <Text className="sub">互动探究 · 知识理解辅助</Text>
      </View>
      {error ? <Text className="err">{error}</Text> : null}
      {courses.length === 0 && !error ? (
        <Text className="muted">暂无已发布内容。</Text>
      ) : null}
      {courses.map((c) => (
        <View key={c.id} className="card">
          <Text className="card-title">
            {SUBJECT[c.subject] ?? c.subject} · {c.title}
          </Text>
          <Text className="card-sub">
            {c.gradeBand === 'PRIMARY'
              ? '小学'
              : c.gradeBand === 'JUNIOR_HIGH'
                ? '初中'
                : c.gradeBand === 'SENIOR_HIGH'
                  ? '高中'
                  : '全学段'}{' '}
            · {c.chapterCount} 章
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
