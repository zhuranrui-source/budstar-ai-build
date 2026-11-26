import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, RichText, Text, View, WebView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import PageState from '../../../components/PageState';
import { API_BASE_URL } from '../../../utils/api';
import {
  isSecureWebViewUrl,
  resolveApiContentUrl,
  sanitizeRichTextHtml,
} from '../../../utils/content';
import {
  getPublishedSubjectCourse,
  type SubjectChapter,
} from '../../../utils/family-api';
import './index.css';

export default function LabContentPage() {
  const router = useRouter();
  const courseId = String(router.params.courseId ?? '').trim();
  const chapterId = String(router.params.chapterId ?? '').trim();
  const [chapter, setChapter] = useState<SubjectChapter | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [webViewError, setWebViewError] = useState('');
  const requestSequence = useRef(0);

  const loadChapter = useCallback(async (): Promise<void> => {
    if (!courseId || !chapterId) {
      setError('缺少课程或章节编号');
      setLoading(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    setWebViewError('');
    try {
      const detail = await getPublishedSubjectCourse(courseId);
      const selected = detail.chapters.find((item) => item.id === chapterId);
      if (!selected) throw new Error('章节不存在或已下架');
      if (sequence !== requestSequence.current) return;
      setCourseTitle(detail.title);
      setChapter(selected);
      void Taro.setNavigationBarTitle({ title: selected.title });
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setChapter(null);
      setError(caught instanceof Error ? caught.message : '章节加载失败');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [chapterId, courseId]);

  useEffect(() => {
    void loadChapter();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadChapter]);

  if (loading) {
    return (
      <View className="page lab-content-page">
        <PageState kind="loading" title="正在准备互动内容" />
      </View>
    );
  }

  if (!chapter) {
    return (
      <View className="page lab-content-page">
        <PageState
          kind="error"
          title="章节暂时无法打开"
          description={error || '请返回课程详情后重试。'}
          actionText="重新加载"
          onAction={() => void loadChapter()}
        />
        <Button
          className="content-back-button"
          onClick={() => Taro.navigateBack()}
        >
          返回课程详情
        </Button>
      </View>
    );
  }

  const resolvedUrl = chapter.contentUrl
    ? resolveApiContentUrl(chapter.contentUrl, API_BASE_URL)
    : '';

  if (webViewError) {
    return (
      <View className="page lab-content-page">
        <PageState
          kind="error"
          title="互动内容打开失败"
          description={webViewError}
          actionText="重试"
          onAction={() => setWebViewError('')}
        />
        <Button
          className="content-back-button"
          onClick={() => Taro.navigateBack()}
        >
          返回课程详情
        </Button>
      </View>
    );
  }

  if (resolvedUrl) {
    if (!isSecureWebViewUrl(resolvedUrl)) {
      return (
        <View className="page lab-content-page">
          <PageState
            kind="error"
            title="真机暂时无法打开本章"
            description="互动内容必须使用 HTTPS 地址，并配置为微信小程序业务域名。"
            actionText="返回课程详情"
            onAction={() => void Taro.navigateBack()}
          />
        </View>
      );
    }
    return (
      <WebView
        src={resolvedUrl}
        onError={() =>
          setWebViewError('请检查网络，并确认内容域名已配置为小程序业务域名。')
        }
      />
    );
  }

  if (!chapter.contentHtml.trim()) {
    return (
      <View className="page lab-content-page">
        <PageState
          kind="empty"
          title="本章内容暂未开放"
          description="课程更新后即可进入。"
          actionText="返回课程详情"
          onAction={() => void Taro.navigateBack()}
        />
      </View>
    );
  }

  return (
    <View className="page lab-content-page">
      <View className="content-head">
        <Text className="content-kicker">第 {chapter.sequence} 章</Text>
        <Text className="content-title">{chapter.title}</Text>
        <Text className="content-course">{courseTitle}</Text>
      </View>
      <View className="chapter-rich-card">
        <RichText
          className="chapter-rich"
          nodes={sanitizeRichTextHtml(chapter.contentHtml)}
        />
      </View>
      <View className="content-finish-tip">
        <Text>完成本章后</Text>
        <Text>回到课程详情，继续探索下一章 →</Text>
      </View>
    </View>
  );
}
