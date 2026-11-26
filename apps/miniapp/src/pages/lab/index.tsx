import { useCallback, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import PageState from '../../components/PageState';
import {
  listPublishedSubjectCourses,
  type SubjectCourseSummary,
} from '../../utils/family-api';
import { gradeBandText, subjectText } from '../../utils/subject';
import './index.css';

const COURSE_TONES = ['coral', 'sky', 'forest', 'pink'];

export default function LabPage() {
  const [courses, setCourses] = useState<SubjectCourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadCourses = useCallback(async (showLoading = true): Promise<void> => {
    const sequence = ++requestSequence.current;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const nextCourses = await listPublishedSubjectCourses();
      if (sequence === requestSequence.current) setCourses(nextCourses);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setCourses([]);
      setError(caught instanceof Error ? caught.message : '课程加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useDidShow(() => {
    void loadCourses();
  });

  usePullDownRefresh(() => {
    void loadCourses(false).finally(() => Taro.stopPullDownRefresh());
  });

  return (
    <View className="page tab-page lab-page">
      <View className="portal-page-head">
        <Text className="portal-kicker">K12 INTERACTIVE LAB</Text>
        <Text className="portal-title">学科实验室</Text>
        <Text className="portal-description">
          从真实问题出发，在动手探索中理解知识背后的原理。
        </Text>
      </View>

      {loading ? (
        <PageState kind="loading" title="正在加载实验课程" />
      ) : error ? (
        <PageState
          kind="error"
          title="实验课程加载失败"
          description={error}
          actionText="重新加载"
          onAction={() => void loadCourses()}
        />
      ) : courses.length === 0 ? (
        <PageState
          kind="empty"
          title="暂无已发布课程"
          description="新课程发布后会显示在这里，下拉页面也可刷新。"
        />
      ) : (
        <>
          <View
            className="featured-course"
            onClick={() =>
              Taro.navigateTo({
                url: `/pages/lab/detail/index?id=${encodeURIComponent(courses[0].id)}`,
              })
            }
          >
            <View className="featured-art">
              <Text className="featured-symbol">
                {subjectText(courses[0].subject).slice(0, 1)}
              </Text>
              <Text className="featured-orbit">✦</Text>
            </View>
            <View className="featured-copy">
              <Text className="course-kicker">本周推荐实验</Text>
              <Text className="featured-title">{courses[0].title}</Text>
              <Text className="featured-description">
                {subjectText(courses[0].subject)} ·{' '}
                {gradeBandText(courses[0].gradeBand)} · 共{' '}
                {courses[0].chapterCount} 章
              </Text>
              <Text className="featured-status">进入课程 →</Text>
            </View>
          </View>

          <View className="lab-section-head">
            <Text className="section-title">全部实验课程</Text>
            <Text className="section-hint">按学科探索</Text>
          </View>
          <View className="course-grid">
            {courses.map((course, index) => (
              <View
                key={course.id}
                className={`lab-course-card lab-course-card--${COURSE_TONES[index % COURSE_TONES.length]}`}
                onClick={() =>
                  Taro.navigateTo({
                    url: `/pages/lab/detail/index?id=${encodeURIComponent(course.id)}`,
                  })
                }
              >
                <View className="lab-course-icon">
                  {subjectText(course.subject).slice(0, 1)}
                </View>
                <Text className="lab-course-subject">
                  {subjectText(course.subject)}
                </Text>
                <Text className="lab-course-title">{course.title}</Text>
                <View className="lab-course-footer">
                  <Text>
                    {gradeBandText(course.gradeBand)} · {course.chapterCount} 章
                  </Text>
                  <Text className="lab-course-arrow">→</Text>
                </View>
              </View>
            ))}
          </View>
          <Text className="section-footnote">
            当前展示已发布课程目录，章节开放后会提供学习入口。
          </Text>
        </>
      )}
    </View>
  );
}
