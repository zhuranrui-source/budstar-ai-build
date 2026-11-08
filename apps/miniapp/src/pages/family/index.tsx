import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  Input,
  Textarea,
} from '@tarojs/components';
import Taro from '@tarojs/taro';
import {
  listBoundStudents,
  selectActiveStudent,
  listStudentClasses,
  getStudentCurriculum,
  transitionSubmission,
  saveSubmissionDraft,
  listPublishedSubjectCourses,
  listPlanetFeed,
  getGrowthView,
  saveSubmissionDraft as saveDraft,
  type Curriculum,
  type SubjectCourseSummary,
  type StudentSwitcher,
  type PlanetPost,
  type GrowthViewData,
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

export default function FamilyPage() {
  const [switcher, setSwitcher] = useState<StudentSwitcher | null>(null);
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [subjects, setSubjects] = useState<SubjectCourseSummary[]>([]);
  const [planet, setPlanet] = useState<PlanetPost[]>([]);
  const [growth, setGrowth] = useState<GrowthViewData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draftLesson, setDraftLesson] = useState<{
    mainLessonId: string;
    classId: string;
    track: string;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [draftUrl, setDraftUrl] = useState('');

  const token = Taro.getStorageSync('accessToken') as string;

  useEffect(() => {
    if (!token) {
      Taro.navigateTo({ url: '/pages/login/index' });
      return;
    }
    void reload();
    listPlanetFeed(token)
      .then(setPlanet)
      .catch(() => setPlanet([]));
  }, []);

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const sw = await listBoundStudents(token);
      setSwitcher(sw);
      const sel = sw.selectedStudentProfileId;
      if (sel) {
        const cs = await listStudentClasses(token, sel);
        if (cs.length > 0)
          setCurriculum(await getStudentCurriculum(token, sel, cs[0].classId));
        else setCurriculum(null);
        getGrowthView(token, sel)
          .then(setGrowth)
          .catch(() => {});
      }
    } catch (c) {
      setError(c instanceof Error ? c.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function switchStudent(id: string) {
    setLoading(true);
    try {
      await selectActiveStudent(token, id);
      await reload();
    } catch (c) {
      setError(c instanceof Error ? c.message : '切换失败');
    } finally {
      setLoading(false);
    }
  }

  async function submitWork(lesson: {
    submission: { id: string; status: string } | null;
  }) {
    if (!lesson.submission || !switcher?.selectedStudentProfileId) return;
    const to =
      lesson.submission.status === 'SUBMITTED' ? 'RESUBMITTED' : 'SUBMITTED';
    setLoading(true);
    try {
      await transitionSubmission(
        token,
        switcher.selectedStudentProfileId,
        lesson.submission.id,
        to,
      );
      await reload();
    } catch (c) {
      setError(c instanceof Error ? c.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }

  async function saveAndSubmit() {
    const student = switcher?.selectedStudentProfileId;
    if (!student || !curriculum || !draftLesson) return;
    if (!draftTitle.trim() || !draftDesc.trim()) {
      setError('请填标题和说明');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const draft = await saveDraft(token, student, {
        classId: curriculum.classId,
        mainLessonId: draftLesson.mainLessonId,
        content: {
          title: draftTitle.trim(),
          description: draftDesc.trim(),
          workUrl: draftUrl.trim() || undefined,
        },
      });
      await transitionSubmission(token, student, draft.id, 'SUBMITTED');
      setDraftLesson(null);
      setDraftTitle('');
      setDraftDesc('');
      setDraftUrl('');
      await reload();
    } catch (c) {
      setError(c instanceof Error ? c.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }

  const selected = switcher?.students.find(
    (s) => s.studentProfileId === switcher?.selectedStudentProfileId,
  );

  return (
    <ScrollView scrollY className="page">
      <View className="section">
        <Text className="h1">家庭视图</Text>
        <Text className="sub">亲子共学 · 家长学生共用</Text>
      </View>

      {error ? (
        <View className="err-box">
          <Text className="err">{error}</Text>
        </View>
      ) : null}
      {loading ? <Text className="muted">加载中…</Text> : null}

      {switcher && switcher.students.length > 0 && (
        <View className="section">
          <Text className="h2">学生切换</Text>
          <View className="chips">
            {switcher.students.map((s) => (
              <Button
                key={s.studentProfileId}
                size="mini"
                type={
                  s.studentProfileId === switcher.selectedStudentProfileId
                    ? 'primary'
                    : 'default'
                }
                onClick={() => void switchStudent(s.studentProfileId)}
              >
                {s.displayName}
              </Button>
            ))}
          </View>
        </View>
      )}

      {curriculum && (
        <View className="section">
          <Text className="h2">课节与作品</Text>
          <Text className="muted">
            {curriculum.className} · {curriculum.coursePackageTitle}
          </Text>
          {curriculum.lessons.map((lesson) => (
            <View key={lesson.mainLessonId} className="card">
              <Text className="card-title">
                {lesson.sequence}. {lesson.title}
              </Text>
              <Text className="card-sub">
                {lesson.submission
                  ? `作品：${lesson.submission.status}`
                  : lesson.assignment
                    ? '待提交'
                    : '无作业'}
              </Text>
              {lesson.submission &&
                ['DRAFT', 'NEEDS_REVISION', 'SUBMITTED'].includes(
                  lesson.submission.status,
                ) && (
                  <Button
                    size="mini"
                    type="primary"
                    disabled={loading}
                    onClick={() => void submitWork(lesson)}
                  >
                    {lesson.submission.status === 'SUBMITTED'
                      ? '重新提交'
                      : '提交作品'}
                  </Button>
                )}
            </View>
          ))}
        </View>
      )}

      {draftLesson && (
        <View className="section card">
          <Text className="h2">写作品</Text>
          <Input
            className="ipt"
            placeholder="作品标题"
            value={draftTitle}
            onInput={(e) => setDraftTitle(e.detail.value)}
          />
          <Textarea
            className="ipt ta"
            placeholder="作品说明"
            value={draftDesc}
            onInput={(e) => setDraftDesc(e.detail.value)}
            maxlength={2000}
          />
          <Input
            className="ipt"
            placeholder="作品链接（可选）"
            value={draftUrl}
            onInput={(e) => setDraftUrl(e.detail.value)}
          />
          <View className="row-btns">
            <Button
              size="mini"
              type="primary"
              loading={loading}
              onClick={() => void saveAndSubmit()}
            >
              保存并提交
            </Button>
            <Button size="mini" onClick={() => setDraftLesson(null)}>
              取消
            </Button>
          </View>
        </View>
      )}

      <View className="section">
        <Text className="h2">星芽星球</Text>
        {planet.length === 0 ? (
          <Text className="muted">暂无可见内容。</Text>
        ) : (
          planet.map((p) => (
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
          ))
        )}
      </View>

      {growth && growth.publishedReports.length > 0 && (
        <View className="section">
          <Text className="h2">成长报告</Text>
          {growth.publishedReports.map((r) => (
            <View key={r.id} className="card">
              <Text className="card-title">第 {r.milestone} 节阶段报告</Text>
              <Text className="card-sub">{r.summary}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
