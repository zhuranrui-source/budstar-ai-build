import { useCallback, useRef, useState } from 'react';
import {
  Button,
  Image,
  Input,
  Picker,
  Switch,
  Text,
  Textarea,
  View,
} from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classroomCover from '../../assets/content/community-classroom.jpg';
import noiseCover from '../../assets/content/community-noise-poster.jpg';
import BrandSections from '../../components/BrandSections';
import PageState from '../../components/PageState';
import { wechatBindPhone } from '../../utils/api';
import {
  bindFamilyWithCode,
  getGrowthView,
  getStudentCurriculum,
  listBoundStudents,
  listPlanetFeed,
  listPublishedSubjectCourses,
  listStudentClasses,
  saveSubmissionDraft,
  selectActiveStudent,
  transitionSubmission,
  type Curriculum,
  type GrowthViewData,
  type PlanetPost,
  type StudentClass,
  type StudentLesson,
  type StudentSwitcher,
  type SubjectCourseSummary,
} from '../../utils/family-api';
import { PREVIEW_MODE } from '../../utils/preview';
import LoginRequired from '../../components/LoginRequired';
import {
  getValidSession,
  requireSession,
  saveSession,
} from '../../utils/session';
import { subjectText } from '../../utils/subject';
import {
  getTransitionStatus,
  hasReachedSubmissionStatus,
  SUBMISSION_STATUS_TEXT,
  validateDraft,
  type DraftForm,
  type SubmissionStatus,
} from '../../utils/submission';
import './index.css';
import { PHONE_WITH_PRIVACY } from '../../utils/legal';

const EMPTY_DRAFT: DraftForm = {
  title: '',
  description: '',
  workUrl: '',
  githubUrl: '',
  demoUrl: '',
};

type DraftContext = {
  studentId: string;
  classId: string;
  lessonId: string;
  lessonTitle: string;
  track: 'AIGC' | 'VIBE_CODING';
  status: SubmissionStatus | null;
};

type PhoneNumberEvent = { detail?: { code?: string } };

export default function FamilyPage() {
  const [switcher, setSwitcher] = useState<StudentSwitcher | null>(null);
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [activeClassId, setActiveClassId] = useState('');
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [subjects, setSubjects] = useState<SubjectCourseSummary[]>([]);
  const [planet, setPlanet] = useState<PlanetPost[]>([]);
  const [growth, setGrowth] = useState<GrowthViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [partialError, setPartialError] = useState('');
  const [draftContext, setDraftContext] = useState<DraftContext | null>(null);
  const [draft, setDraft] = useState<DraftForm>(EMPTY_DRAFT);
  const [familyCode, setFamilyCode] = useState('');
  const [displayConsent, setDisplayConsent] = useState(false);
  const [showBinding, setShowBinding] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const requestSequence = useRef(0);

  const loadDashboard = useCallback(
    async (showLoading = true, preferredClassId = ''): Promise<void> => {
      const session = getValidSession();
      setNeedsLogin(!session);
      if (!session) {
        setLoading(false);
        return;
      }
      const sequence = ++requestSequence.current;
      if (showLoading) setLoading(true);
      setError('');
      setPartialError('');

      try {
        const [studentsResult, subjectsResult, planetResult] =
          await Promise.allSettled([
            listBoundStudents(session.accessToken),
            listPublishedSubjectCourses(),
            listPlanetFeed(session.accessToken),
          ]);
        if (sequence !== requestSequence.current) return;
        if (studentsResult.status === 'rejected') throw studentsResult.reason;

        const nextSwitcher = studentsResult.value;
        setSwitcher(nextSwitcher);
        if (subjectsResult.status === 'fulfilled')
          setSubjects(subjectsResult.value);
        else setSubjects([]);
        if (planetResult.status === 'fulfilled') setPlanet(planetResult.value);
        else setPlanet([]);
        if (
          subjectsResult.status === 'rejected' ||
          planetResult.status === 'rejected'
        ) {
          setPartialError('部分内容暂时未加载，可下拉刷新重试');
        }

        const studentId = nextSwitcher.selectedStudentProfileId;
        if (!studentId) {
          setClasses([]);
          setActiveClassId('');
          setCurriculum(null);
          setGrowth(null);
          return;
        }

        const [classesResult, growthResult] = await Promise.allSettled([
          listStudentClasses(session.accessToken, studentId),
          getGrowthView(session.accessToken, studentId),
        ]);
        if (sequence !== requestSequence.current) return;
        if (classesResult.status === 'rejected') throw classesResult.reason;

        const nextClasses = classesResult.value;
        setClasses(nextClasses);
        if (growthResult.status === 'fulfilled') setGrowth(growthResult.value);
        else {
          setGrowth(null);
          setPartialError('成长数据暂时未加载，可下拉刷新重试');
        }

        const nextClassId =
          [preferredClassId, activeClassId].find((classId) =>
            nextClasses.some((item) => item.classId === classId),
          ) ??
          nextClasses[0]?.classId ??
          '';
        setActiveClassId(nextClassId);
        if (!nextClassId) {
          setCurriculum(null);
          return;
        }
        const nextCurriculum = await getStudentCurriculum(
          session.accessToken,
          studentId,
          nextClassId,
        );
        if (sequence === requestSequence.current) setCurriculum(nextCurriculum);
      } catch (caught) {
        if (sequence !== requestSequence.current) return;
        setError(caught instanceof Error ? caught.message : '家庭数据加载失败');
        setCurriculum(null);
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [activeClassId],
  );

  useDidShow(() => {
    if (Taro.getStorageSync('budstar.openFamilyBinding')) {
      Taro.removeStorageSync('budstar.openFamilyBinding');
      setShowBinding(true);
    }
    void loadDashboard();
    if (Taro.getStorageSync('budstar.scrollToAppointment')) {
      Taro.removeStorageSync('budstar.scrollToAppointment');
      setTimeout(() => {
        void Taro.pageScrollTo({
          selector: '#home-appointment',
          duration: 300,
        });
      }, 400);
    }
  });

  usePullDownRefresh(() => {
    void loadDashboard(false).finally(() => Taro.stopPullDownRefresh());
  });

  function resetDraft(): void {
    setDraftContext(null);
    setDraft(EMPTY_DRAFT);
  }

  async function confirmDiscardDraft(): Promise<boolean> {
    if (!draftContext) return true;
    const result = await Taro.showModal({
      title: '放弃编辑？',
      content: '尚未提交的内容不会保留。',
      confirmText: '放弃',
      confirmColor: '#d54941',
    });
    if (result.confirm) resetDraft();
    return result.confirm;
  }

  async function handleSwitchStudent(studentId: string): Promise<void> {
    if (busy || studentId === switcher?.selectedStudentProfileId) return;
    if (!(await confirmDiscardDraft())) return;
    const session = requireSession();
    if (!session) return;
    setBusy(true);
    setError('');
    try {
      await selectActiveStudent(session.accessToken, studentId);
      setActiveClassId('');
      setCurriculum(null);
      setGrowth(null);
      await loadDashboard(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '切换学生失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleClassChange(index: number): Promise<void> {
    const nextClass = classes[index];
    if (!nextClass || nextClass.classId === activeClassId || busy) return;
    if (!(await confirmDiscardDraft())) return;
    setActiveClassId(nextClass.classId);
    setCurriculum(null);
    await loadDashboard(false, nextClass.classId);
  }

  function openDraft(lesson: StudentLesson): void {
    const studentId = switcher?.selectedStudentProfileId;
    if (!studentId || !curriculum) return;
    setDraftContext({
      studentId,
      classId: curriculum.classId,
      lessonId: lesson.mainLessonId,
      lessonTitle: lesson.title,
      track: lesson.track,
      status: lesson.submission?.status ?? null,
    });
    setDraft(EMPTY_DRAFT);
  }

  async function reconcileSubmission(
    accessToken: string,
    context: Pick<DraftContext, 'studentId' | 'classId' | 'lessonId'>,
    targetStatus: 'SUBMITTED' | 'RESUBMITTED',
  ): Promise<boolean> {
    try {
      const latest = await getStudentCurriculum(
        accessToken,
        context.studentId,
        context.classId,
      );
      const status = latest.lessons.find(
        (lesson) => lesson.mainLessonId === context.lessonId,
      )?.submission?.status;
      if (!hasReachedSubmissionStatus(status, targetStatus)) return false;
      setCurriculum(latest);
      resetDraft();
      await Taro.showToast({ title: '作品已提交', icon: 'success' });
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmitDraft(): Promise<void> {
    const context = draftContext;
    if (!context || busy) return;
    const validationError = validateDraft(context.track, draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    const session = requireSession();
    if (!session) return;
    const targetStatus = getTransitionStatus(context.status);
    setBusy(true);
    setError('');
    try {
      const content =
        context.track === 'VIBE_CODING'
          ? {
              title: draft.title.trim(),
              description: draft.description.trim(),
              githubUrl: draft.githubUrl.trim(),
              demoUrl: draft.demoUrl.trim(),
            }
          : {
              title: draft.title.trim(),
              description: draft.description.trim(),
              ...(draft.workUrl.trim()
                ? { workUrl: draft.workUrl.trim() }
                : {}),
            };
      const saved = await saveSubmissionDraft(
        session.accessToken,
        context.studentId,
        {
          classId: context.classId,
          mainLessonId: context.lessonId,
          content,
        },
      );
      await transitionSubmission(
        session.accessToken,
        context.studentId,
        saved.id,
        targetStatus,
      );
      resetDraft();
      await Taro.showToast({ title: '作品已提交', icon: 'success' });
      await loadDashboard(false, context.classId);
    } catch (caught) {
      if (
        await reconcileSubmission(session.accessToken, context, targetStatus)
      ) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '作品提交失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitExisting(lesson: StudentLesson): Promise<void> {
    const studentId = switcher?.selectedStudentProfileId;
    if (!lesson.submission || busy || !studentId || !activeClassId) return;
    const targetStatus = getTransitionStatus(lesson.submission.status);
    const isRevision = lesson.submission.status === 'NEEDS_REVISION';
    const modal = await Taro.showModal({
      title: isRevision ? '重新提交作品' : '提交作品',
      content: isRevision
        ? '当前将保留已有作品内容，并按原内容重新提交。确认继续吗？'
        : '提交后需等待老师反馈，确认现在提交吗？',
      confirmColor: '#f4845f',
    });
    if (!modal.confirm) return;
    const session = requireSession();
    if (!session) return;
    const context = {
      studentId,
      classId: activeClassId,
      lessonId: lesson.mainLessonId,
    };
    setBusy(true);
    setError('');
    try {
      await transitionSubmission(
        session.accessToken,
        studentId,
        lesson.submission.id,
        targetStatus,
      );
      await Taro.showToast({ title: '提交成功', icon: 'success' });
      await loadDashboard(false, activeClassId);
    } catch (caught) {
      if (
        await reconcileSubmission(session.accessToken, context, targetStatus)
      ) {
        return;
      }
      setError(caught instanceof Error ? caught.message : '作品提交失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleBindFamily(): Promise<void> {
    const normalized = familyCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(normalized)) {
      setError('家庭查看码应为 8 位大写字母或数字');
      return;
    }
    const session = requireSession();
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      await bindFamilyWithCode(session.accessToken, normalized, displayConsent);
      setFamilyCode('');
      setShowBinding(false);
      await Taro.showToast({ title: '绑定成功', icon: 'success' });
      await loadDashboard(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '绑定失败');
    } finally {
      setBusy(false);
    }
  }

  async function handleBindPhone(event: PhoneNumberEvent): Promise<void> {
    const code = event.detail?.code;
    if (!code) {
      setError('未获得手机号授权，可稍后在“我的”页面重试');
      return;
    }
    const session = requireSession();
    if (!session || busy) return;
    setBusy(true);
    setError('');
    try {
      const nextSession = await wechatBindPhone(session.accessToken, code);
      saveSession(nextSession, 'wechat', true);
      await Taro.showToast({ title: '手机号已绑定', icon: 'success' });
      await loadDashboard(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '手机号绑定失败');
    } finally {
      setBusy(false);
    }
  }

  const selectedStudent = switcher?.students.find(
    (student) => student.studentProfileId === switcher.selectedStudentProfileId,
  );
  const activeClassIndex = Math.max(
    0,
    classes.findIndex((item) => item.classId === activeClassId),
  );
  const lessons = curriculum?.lessons ?? [];
  const assignmentLessons = lessons.filter((lesson) => lesson.assignment);
  const workRecords = lessons.filter((lesson) => lesson.submission);
  const submittedWorkCount = workRecords.filter(
    (lesson) => lesson.submission?.status !== 'DRAFT',
  ).length;
  const feedbackCount = growth?.publishedReports.length ?? 0;
  const recentWorks = workRecords.slice().reverse().slice(0, 2);
  const progress = assignmentLessons.length
    ? Math.round((submittedWorkCount / assignmentLessons.length) * 100)
    : 0;

  return (
    <View className="page tab-page family-page">
      <View className="family-brand-head">
        <View className="family-brand-lockup">
          <View className="family-brand-mark">芽</View>
          <View>
            <Text className="family-brand-title">星芽家庭</Text>
            <Text className="family-brand-subtitle">成长与作品都在这里</Text>
          </View>
        </View>
        <Text className="family-brand-caption">家长社区</Text>
      </View>

      {error ? (
        <View className="message message--error">
          <Text>{error}</Text>
          <Text className="message-close" onClick={() => setError('')}>
            ×
          </Text>
        </View>
      ) : null}
      {partialError ? (
        <View className="message message--warning">{partialError}</View>
      ) : null}

      {needsLogin ? (
        <LoginRequired description="登录后可查看孩子的课节、作品和成长反馈。" />
      ) : loading ? (
        <PageState
          kind="loading"
          title="正在加载家庭数据"
          description="请稍候…"
        />
      ) : !switcher ? (
        <PageState
          kind="error"
          title="家庭数据加载失败"
          description="请检查网络后重试"
          actionText="重新加载"
          onAction={() => void loadDashboard()}
        />
      ) : (
        <>
          {switcher.students.length > 0 ? (
            <View className="section">
              <View className="section-header section-header--inline">
                <View>
                  <Text className="section-title">当前学生</Text>
                  <Text className="section-hint">选择要查看的学生档案</Text>
                </View>
                <Text
                  className="section-link"
                  onClick={() => setShowBinding(true)}
                >
                  绑定孩子
                </Text>
              </View>
              <View className="chip-list">
                {switcher.students.map((student) => {
                  const active =
                    student.studentProfileId ===
                    switcher.selectedStudentProfileId;
                  return (
                    <Button
                      key={student.studentProfileId}
                      className={`chip ${active ? 'chip--active' : ''}`}
                      size="mini"
                      disabled={busy}
                      onClick={() =>
                        void handleSwitchStudent(student.studentProfileId)
                      }
                    >
                      {student.displayName}
                    </Button>
                  );
                })}
              </View>
            </View>
          ) : (
            <View className="section onboarding-card">
              <Text className="section-title">关联家庭学习档案</Text>
              <Text className="section-description">
                输入校区老师提供的 8
                位家庭查看码，即可查看学生课节、作品和成长报告。
              </Text>
              <Input
                className="form-control code-input"
                maxlength={8}
                placeholder="请输入家庭查看码"
                value={familyCode}
                onInput={(event) =>
                  setFamilyCode(
                    event.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  )
                }
              />
              <View className="consent-row">
                <View className="consent-copy">
                  <Text className="cell-title">允许展示优秀作品</Text>
                  <Text className="cell-description">
                    可随时联系校区调整授权
                  </Text>
                </View>
                <Switch
                  color="#f4845f"
                  checked={displayConsent}
                  onChange={(event) => setDisplayConsent(event.detail.value)}
                />
              </View>
              <Button
                className="primary-action"
                loading={busy}
                disabled={busy || familyCode.length !== 8}
                onClick={() => void handleBindFamily()}
              >
                绑定学生档案
              </Button>
              <Button
                className="outline-action"
                disabled={busy}
                openType={PHONE_WITH_PRIVACY}
                onGetPhoneNumber={(event) => void handleBindPhone(event)}
              >
                绑定手机号匹配已有家庭
              </Button>
            </View>
          )}

          {switcher.students.length > 0 && showBinding ? (
            <View className="section onboarding-card">
              <View className="section-header section-header--inline">
                <View>
                  <Text className="section-title">绑定另一个孩子</Text>
                  <Text className="section-description">
                    输入校区老师提供的 8 位家庭查看码。
                  </Text>
                </View>
                <Text
                  className="section-link"
                  onClick={() => setShowBinding(false)}
                >
                  收起
                </Text>
              </View>
              <Input
                className="form-control code-input"
                maxlength={8}
                placeholder="请输入家庭查看码"
                value={familyCode}
                onInput={(event) =>
                  setFamilyCode(
                    event.detail.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                  )
                }
              />
              <View className="consent-row">
                <View className="consent-copy">
                  <Text className="cell-title">允许展示优秀作品</Text>
                  <Text className="cell-description">
                    可随时联系校区调整授权
                  </Text>
                </View>
                <Switch
                  color="#f4845f"
                  checked={displayConsent}
                  onChange={(event) => setDisplayConsent(event.detail.value)}
                />
              </View>
              <Button
                className="primary-action"
                loading={busy}
                disabled={busy || familyCode.length !== 8}
                onClick={() => void handleBindFamily()}
              >
                确认绑定
              </Button>
            </View>
          ) : null}

          {selectedStudent ? (
            <View className="child-overview-card">
              <View className="child-overview-top">
                <View className="child-identity">
                  <View className="child-avatar">
                    {selectedStudent.displayName.slice(0, 1)}
                  </View>
                  <View>
                    <Text className="child-name">
                      {selectedStudent.displayName}
                    </Text>
                    <Text className="child-class">
                      {classes[activeClassIndex]?.className ?? '星芽学习档案'}
                    </Text>
                  </View>
                </View>
                <Text className="child-status">成长中</Text>
              </View>
              <View className="child-stat-grid">
                <View className="child-stat">
                  <Text>课程</Text>
                  <Text className="child-stat-value">
                    {lessons.length || '—'}
                  </Text>
                  <Text>已发布课节</Text>
                </View>
                <View className="child-stat">
                  <Text>作品</Text>
                  <Text className="child-stat-value">{workRecords.length}</Text>
                  <Text>创作记录</Text>
                </View>
                <View className="child-stat">
                  <Text>反馈</Text>
                  <Text className="child-stat-value">{feedbackCount}</Text>
                  <Text>阶段报告</Text>
                </View>
              </View>
              {assignmentLessons.length ? (
                <View className="child-progress-wrap">
                  <View className="child-progress-copy">
                    <Text>作品提交进度</Text>
                    <Text>{progress}%</Text>
                  </View>
                  <View className="child-progress">
                    <View
                      className="child-progress-value"
                      style={{ width: `${progress}%` }}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {selectedStudent && recentWorks.length > 0 ? (
            <View className="section recent-works-section">
              <View className="section-header section-header--inline">
                <View>
                  <Text className="section-title">最近作品</Text>
                  <Text className="section-hint">每一次创作都有成长的痕迹</Text>
                </View>
                <Text
                  className="section-link"
                  onClick={() => Taro.switchTab({ url: '/pages/planet/index' })}
                >
                  查看星球
                </Text>
              </View>
              <View className="recent-work-grid">
                {recentWorks.map((lesson, index) => (
                  <View key={lesson.mainLessonId} className="recent-work-card">
                    {PREVIEW_MODE ? (
                      <Image
                        className="recent-work-image"
                        src={index % 2 === 0 ? noiseCover : classroomCover}
                        mode="aspectFill"
                      />
                    ) : (
                      <View
                        className={`recent-work-cover recent-work-cover--${index % 2}`}
                      >
                        <Text>作品</Text>
                      </View>
                    )}
                    <View className="recent-work-copy">
                      <Text className="recent-work-title">{lesson.title}</Text>
                      <Text className="recent-work-meta">
                        第 {lesson.sequence} 课 ·{' '}
                        {lesson.submission
                          ? SUBMISSION_STATUS_TEXT[lesson.submission.status]
                          : '创作中'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {selectedStudent && classes.length === 0 ? (
            <PageState
              kind="empty"
              title="暂未加入班级"
              description="学生档案已绑定，加入班级后会在这里显示课节。"
            />
          ) : null}

          {selectedStudent && classes.length > 0 ? (
            <View className="section">
              <View className="section-header section-header--inline">
                <View>
                  <Text className="section-title">课节与作品</Text>
                  <Text className="section-hint">
                    {curriculum
                      ? `${curriculum.coursePackageTitle} · ${curriculum.coursePackageVersion}`
                      : '正在读取课程'}
                  </Text>
                </View>
                {classes.length > 1 ? (
                  <Picker
                    mode="selector"
                    range={classes.map((item) => item.className)}
                    value={activeClassIndex}
                    onChange={(event) =>
                      void handleClassChange(Number(event.detail.value))
                    }
                  >
                    <View className="picker-trigger">
                      {classes[activeClassIndex]?.className ?? '选择班级'}⌄
                    </View>
                  </Picker>
                ) : (
                  <Text className="class-label">{classes[0]?.className}</Text>
                )}
              </View>

              {!curriculum ? (
                error ? (
                  <PageState
                    kind="error"
                    title="课节加载失败"
                    description={error}
                    actionText="重新加载"
                    onAction={() => void loadDashboard(false, activeClassId)}
                  />
                ) : (
                  <PageState kind="loading" title="正在加载课节" />
                )
              ) : curriculum.lessons.length === 0 ? (
                <PageState
                  kind="empty"
                  title="暂无课节"
                  description="课程发布后会显示在这里。"
                />
              ) : (
                <View className="lesson-list">
                  {curriculum.lessons.map((lesson) => (
                    <View key={lesson.mainLessonId} className="lesson-cell">
                      <View className="lesson-sequence">{lesson.sequence}</View>
                      <View className="lesson-content">
                        <Text className="cell-title">{lesson.title}</Text>
                        <Text className="cell-description">
                          {lesson.assignment
                            ? lesson.submission
                              ? SUBMISSION_STATUS_TEXT[lesson.submission.status]
                              : `待完成：${lesson.assignment.title}`
                            : '本课节无需提交作品'}
                        </Text>
                        {lesson.assignment?.requirements ? (
                          <Text className="assignment-requirements">
                            {lesson.assignment.requirements}
                          </Text>
                        ) : null}
                        {lesson.assignment && !lesson.submission ? (
                          <Button
                            className="inline-action"
                            size="mini"
                            disabled={busy || Boolean(draftContext)}
                            onClick={() => openDraft(lesson)}
                          >
                            写作品
                          </Button>
                        ) : null}
                        {lesson.submission?.status === 'DRAFT' ? (
                          <Button
                            className="inline-action"
                            size="mini"
                            disabled={busy || Boolean(draftContext)}
                            onClick={() => void handleSubmitExisting(lesson)}
                          >
                            提交草稿
                          </Button>
                        ) : null}
                        {lesson.submission?.status === 'NEEDS_REVISION' ? (
                          <Button
                            className="inline-action"
                            size="mini"
                            disabled={busy || Boolean(draftContext)}
                            onClick={() => void handleSubmitExisting(lesson)}
                          >
                            按原内容重新提交
                          </Button>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {draftContext ? (
            <View className="section editor-card">
              <Text className="section-title">提交作品</Text>
              <Text className="section-description">
                {draftContext.lessonTitle}
              </Text>
              <Text className="field-name">作品标题</Text>
              <Input
                className="form-control"
                maxlength={200}
                placeholder="为作品起一个名字"
                value={draft.title}
                onInput={(event) =>
                  setDraft({ ...draft, title: event.detail.value })
                }
              />
              <Text className="field-name">作品说明</Text>
              <Textarea
                className="form-control textarea-control"
                maxlength={2000}
                placeholder="介绍创作思路、过程和收获"
                value={draft.description}
                onInput={(event) =>
                  setDraft({ ...draft, description: event.detail.value })
                }
              />
              {draftContext.track === 'VIBE_CODING' ? (
                <>
                  <Text className="field-name">GitHub 仓库地址</Text>
                  <Input
                    className="form-control"
                    placeholder="https://github.com/..."
                    value={draft.githubUrl}
                    onInput={(event) =>
                      setDraft({ ...draft, githubUrl: event.detail.value })
                    }
                  />
                  <Text className="field-name">在线演示地址</Text>
                  <Input
                    className="form-control"
                    placeholder="https://..."
                    value={draft.demoUrl}
                    onInput={(event) =>
                      setDraft({ ...draft, demoUrl: event.detail.value })
                    }
                  />
                </>
              ) : (
                <>
                  <Text className="field-name">作品链接（选填）</Text>
                  <Input
                    className="form-control"
                    placeholder="https://..."
                    value={draft.workUrl}
                    onInput={(event) =>
                      setDraft({ ...draft, workUrl: event.detail.value })
                    }
                  />
                </>
              )}
              <View className="action-row">
                <Button
                  className="primary-action action-row-button"
                  loading={busy}
                  disabled={busy}
                  onClick={() => void handleSubmitDraft()}
                >
                  保存并提交
                </Button>
                <Button
                  className="outline-action action-row-button"
                  disabled={busy}
                  onClick={() => void confirmDiscardDraft()}
                >
                  取消
                </Button>
              </View>
            </View>
          ) : null}

          {selectedStudent ? (
            <>
              <View className="section">
                <View className="section-header section-header--inline">
                  <View>
                    <Text className="section-title">学科实验室</Text>
                    <Text className="section-hint">互动探究课程</Text>
                  </View>
                  <Text
                    className="section-link"
                    onClick={() => Taro.switchTab({ url: '/pages/lab/index' })}
                  >
                    查看全部
                  </Text>
                </View>
                {subjects.length === 0 ? (
                  <Text className="empty-line">暂无已发布内容</Text>
                ) : (
                  subjects.slice(0, 3).map((course) => (
                    <View
                      key={course.id}
                      className="simple-cell"
                      onClick={() =>
                        Taro.navigateTo({
                          url: `/pages/lab/detail/index?id=${encodeURIComponent(course.id)}`,
                        })
                      }
                    >
                      <Text className="subject-dot">
                        {subjectText(course.subject).slice(0, 1)}
                      </Text>
                      <View className="simple-cell-content">
                        <Text className="cell-title">{course.title}</Text>
                        <Text className="cell-description">
                          {subjectText(course.subject)} · {course.chapterCount}{' '}
                          章
                        </Text>
                      </View>
                      <Text className="section-card-arrow">→</Text>
                    </View>
                  ))
                )}
              </View>

              <View className="section">
                <View className="section-header section-header--inline">
                  <View>
                    <Text className="section-title">星芽星球</Text>
                    <Text className="section-hint">家庭可见的作品动态</Text>
                  </View>
                  <Text
                    className="section-link"
                    onClick={() =>
                      Taro.switchTab({ url: '/pages/planet/index' })
                    }
                  >
                    查看全部
                  </Text>
                </View>
                {planet.length === 0 ? (
                  <Text className="empty-line">暂无可见内容</Text>
                ) : (
                  planet.slice(0, 3).map((post) => (
                    <View key={post.id} className="simple-cell">
                      <View className="avatar-small">
                        {post.studentDisplayName.slice(0, 1)}
                      </View>
                      <View className="simple-cell-content">
                        <Text className="cell-title">{post.title}</Text>
                        <Text className="cell-description">
                          {post.studentDisplayName}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View className="section">
                <View className="section-header">
                  <Text className="section-title">成长记录</Text>
                  <Text className="section-hint">
                    {growth?.confirmedEvaluations.length
                      ? `${growth.confirmedEvaluations.length} 份已确认评价`
                      : '记录每个阶段的进步'}
                  </Text>
                </View>
                {!growth || growth.publishedReports.length === 0 ? (
                  <Text className="empty-line">暂无已发布成长报告</Text>
                ) : (
                  growth.publishedReports.map((report) => (
                    <View key={report.id} className="report-card">
                      <Text className="report-tag">
                        第 {report.milestone} 节阶段报告
                      </Text>
                      <Text className="report-summary">{report.summary}</Text>
                      {report.teacherObservation ? (
                        <Text className="report-observation">
                          老师观察：{report.teacherObservation}
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </>
      )}
      <BrandSections />
    </View>
  );
}
