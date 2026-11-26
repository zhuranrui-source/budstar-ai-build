import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import PageState from '../../../components/PageState';
import {
  getPublishedSubjectCourse,
  type SubjectCourseDetail,
  type SubjectChapter,
} from '../../../utils/family-api';
import { gradeBandText, subjectText } from '../../../utils/subject';
import './index.css';

export default function LabDetailPage() {
  const router = useRouter();
  const courseId = String(router.params.id ?? '').trim();
  const [course, setCourse] = useState<SubjectCourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const loadCourse = useCallback(async (): Promise<void> => {
    if (!courseId) {
      setError('缺少课程编号，无法加载详情');
      setLoading(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const detail = await getPublishedSubjectCourse(courseId);
      if (sequence === requestSequence.current) setCourse(detail);
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setCourse(null);
      setError(caught instanceof Error ? caught.message : '课程详情加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void loadCourse();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadCourse]);

  function openChapter(chapter: SubjectChapter): void {
    if (!chapter.contentUrl && !chapter.contentHtml.trim()) return;
    void Taro.navigateTo({
      url: `/pages/lab/content/index?courseId=${encodeURIComponent(courseId)}&chapterId=${encodeURIComponent(chapter.id)}`,
    });
  }

  if (loading) {
    return (
      <View className="page lab-detail-page">
        <PageState kind="loading" title="正在加载课程详情" />
      </View>
    );
  }

  if (!course) {
    return (
      <View className="page lab-detail-page">
        <PageState
          kind="error"
          title="课程暂时无法打开"
          description={error || '课程可能已下架，请返回后重试。'}
          actionText={courseId ? '重新加载' : '返回课程列表'}
          onAction={() =>
            courseId ? void loadCourse() : void Taro.navigateBack()
          }
        />
        {courseId ? (
          <Button
            className="detail-back-button"
            onClick={() => Taro.navigateBack()}
          >
            返回课程列表
          </Button>
        ) : null}
      </View>
    );
  }

  return (
    <View className="page lab-detail-page">
      <View className="course-detail-hero">
        <View className="course-detail-symbol">
          {subjectText(course.subject).slice(0, 1)}
        </View>
        <Text className="course-detail-kicker">INTERACTIVE COURSE</Text>
        <Text className="course-detail-title">{course.title}</Text>
        <View className="course-detail-tags">
          <Text>{subjectText(course.subject)}</Text>
          <Text>{gradeBandText(course.gradeBand)}</Text>
          {course.gradeLevel ? <Text>{course.gradeLevel} 年级</Text> : null}
          <Text>{course.chapters.length} 个章节</Text>
        </View>
      </View>

      <View className="detail-intro">
        <Text className="section-title">课程章节</Text>
        <Text className="section-description">
          按顺序进入互动内容。完成观察、尝试和表达后，再继续下一章。
        </Text>
      </View>

      {course.chapters.length === 0 ? (
        <PageState
          kind="empty"
          title="章节内容暂未开放"
          description="课程更新后会显示在这里。"
        />
      ) : (
        <View className="chapter-list">
          {course.chapters.map((chapter, index) => {
            const available = Boolean(
              chapter.contentUrl || chapter.contentHtml.trim(),
            );
            return (
              <View
                key={chapter.id}
                className={`chapter-card ${available ? 'chapter-card--available' : 'chapter-card--disabled'}`}
                onClick={() => openChapter(chapter)}
              >
                <View className="chapter-number">
                  {String(chapter.sequence).padStart(2, '0')}
                </View>
                <View className="chapter-copy">
                  <Text className="chapter-label">
                    第 {chapter.sequence} 章
                  </Text>
                  <Text className="chapter-title">{chapter.title}</Text>
                  <Text className="chapter-status">
                    {available
                      ? index === 0
                        ? '建议从这里开始'
                        : '互动内容已开放'
                      : '内容准备中'}
                  </Text>
                </View>
                <Text className="chapter-arrow">{available ? '→' : '·'}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View className="learning-tip">
        <Text className="learning-tip-label">星芽学习建议</Text>
        <Text className="learning-tip-title">先猜想，再验证</Text>
        <Text className="learning-tip-copy">
          进入实验前先说出自己的判断。完成操作后，用观察到的现象解释结论。
        </Text>
      </View>
    </View>
  );
}
