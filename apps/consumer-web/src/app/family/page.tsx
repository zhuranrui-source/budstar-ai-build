'use client';

import { useEffect, useState } from 'react';
import {
  getStudentCurriculumForParent,
  listBoundStudents,
  listFamilyBindings,
  listStudentClassesForParent,
  selectActiveStudent,
  transitionStudentSubmissionForParent,
} from '../family-api';
import type {
  ClassMembership,
  StudentClassCurriculum,
} from '@budstar/contracts';
import { activeAccessToken, resolveActiveRole } from '../auth-session';
import { CommunityShell } from '../community-shell';
import { DEMO_CHILD, DEMO_PARENT_GROWTH } from '../portal-demo-content';

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

type GrowthView = {
  studentProfileId: string;
  publishedFeedback: Array<{
    id: string;
    lessonTitle: string;
    body: string;
    publishedAt: string | null;
  }>;
  confirmedEvaluations: Array<{
    id: string;
    scores: Array<{ dimension: string; level: number; rationale: string }>;
  }>;
  publishedReports: Array<{
    id: string;
    milestone: number;
    summary: string;
    teacherObservation: string | null;
    scores: Array<{ dimension: string; level: number; rationale: string }>;
  }>;
};

export default function FamilyPortalPage() {
  const [students, setStudents] = useState<
    Array<{ studentProfileId: string; displayName: string; selected: boolean }>
  >([]);
  const [growth, setGrowth] = useState<GrowthView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [usingDemo, setUsingDemo] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [classes, setClasses] = useState<ClassMembership[]>([]);
  const [curriculum, setCurriculum] = useState<StudentClassCurriculum | null>(
    null,
  );
  const [learningError, setLearningError] = useState('');

  function applyDemo(
    existing: Array<{
      studentProfileId: string;
      displayName: string;
      selected: boolean;
    }> = [],
  ) {
    setUsingDemo(true);
    setStudents(
      existing.length
        ? existing
        : [
            {
              studentProfileId: 'demo-child',
              displayName: DEMO_CHILD.name,
              selected: true,
            },
          ],
    );
    setGrowth({
      studentProfileId: 'demo-child',
      publishedFeedback: DEMO_PARENT_GROWTH.timeline.map((item, index) => ({
        id: `fb-${index}`,
        lessonTitle: item.title,
        body: item.body,
        publishedAt: `2026-07-${12 - index * 7}`,
      })),
      confirmedEvaluations: [
        {
          id: 'eval-1',
          scores: DEMO_PARENT_GROWTH.dimensions.map((item) => ({ ...item })),
        },
      ],
      publishedReports: [
        {
          id: 'report-1',
          milestone: DEMO_PARENT_GROWTH.report.milestone,
          summary: DEMO_PARENT_GROWTH.report.summary,
          teacherObservation: DEMO_PARENT_GROWTH.report.teacherObservation,
          scores: DEMO_PARENT_GROWTH.dimensions.map((item) => ({ ...item })),
        },
      ],
    });
  }

  async function switchStudent(studentProfileId: string) {
    if (studentProfileId === 'demo-child') return;
    const token = activeAccessToken('parent') ?? '';
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      await selectActiveStudent(token, { studentProfileId });
      setReloadKey((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '切换失败');
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (resolveActiveRole() !== 'parent') {
        setError('请先以家长身份登录');
        applyDemo();
        setBootstrapped(true);
        return;
      }
      const token = activeAccessToken('parent') ?? '';
      if (!token) {
        setError('请先登录后再查看孩子成长');
        setBootstrapped(true);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const switcher = await listBoundStudents(token);
        await listFamilyBindings(token);
        const nextStudents = switcher.students.map((item) => ({
          studentProfileId: item.studentProfileId,
          displayName: item.displayName,
          selected: item.studentProfileId === switcher.selectedStudentProfileId,
        }));
        const selected =
          switcher.selectedStudentProfileId ??
          switcher.students[0]?.studentProfileId;
        let nextGrowth: GrowthView | null = null;
        if (selected) {
          const response = await fetch(
            `${apiBaseUrl}/family/growth/${selected}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          if (!response.ok) throw new Error(`GROWTH_${response.status}`);
          nextGrowth = (await response.json()) as GrowthView;
        }
        if (cancelled) return;
        const emptyStudents = nextStudents.length === 0;
        const emptyGrowth =
          !nextGrowth ||
          (nextGrowth.publishedFeedback.length === 0 &&
            nextGrowth.confirmedEvaluations.length === 0 &&
            nextGrowth.publishedReports.length === 0);
        if (emptyStudents || emptyGrowth) {
          applyDemo(nextStudents);
        } else {
          setStudents(nextStudents);
          setGrowth(nextGrowth);
          setUsingDemo(false);
        }
        setBootstrapped(true);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : '加载失败');
        applyDemo();
        setBootstrapped(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);
  // ADR-0007：家庭视图学习区——按当前选中的学生档案拉取课节与作品
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      const student = students.find((item) => item.selected);
      if (!student || student.studentProfileId === 'demo-child') {
        setClasses([]);
        setCurriculum(null);
        return;
      }
      const token = activeAccessToken('parent') ?? '';
      if (!token) return;
      setLearningError('');
      try {
        const memberships = await listStudentClassesForParent(
          token,
          student.studentProfileId,
        );
        if (cancelled) return;
        setClasses(memberships);
        if (memberships.length === 0) {
          setCurriculum(null);
          return;
        }
        const first = memberships[0];
        const data = await getStudentCurriculumForParent(
          token,
          student.studentProfileId,
          first.classId,
        );
        if (cancelled) return;
        setCurriculum(data);
      } catch (cause) {
        if (cancelled) return;
        setLearningError(
          cause instanceof Error ? cause.message : '课节加载失败',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [students]);

  async function submitLesson(
    submissionId: string,
    toStatus: 'SUBMITTED' | 'RESUBMITTED',
  ) {
    const student = students.find((item) => item.selected);
    if (!student || student.studentProfileId === 'demo-child') return;
    const token = activeAccessToken('parent') ?? '';
    if (!token) return;
    setLearningError('');
    try {
      await transitionStudentSubmissionForParent(
        token,
        student.studentProfileId,
        submissionId,
        { toStatus },
      );
      const data = curriculum
        ? await getStudentCurriculumForParent(
            token,
            student.studentProfileId,
            curriculum.classId,
          )
        : null;
      if (data) setCurriculum(data);
    } catch (cause) {
      setLearningError(
        cause instanceof Error ? cause.message : '提交失败，请重试',
      );
    }
  }

  const selected = students.find((item) => item.selected);

  return (
    <CommunityShell active="family" subtitle="家庭门户">
      <section className="community-panel is-active">
        <div className="community-page-head">
          <div>
            <h1>孩子成长</h1>
            <p>课程进度、作品墙、五维评价、老师反馈和阶段报告集中在这里。</p>
          </div>
          <span className="community-role-badge">家长模式</span>
        </div>

        {!bootstrapped && <p>正在加载家庭门户…</p>}
        {error && <p role="alert">{error}</p>}
        {usingDemo && (
          <p role="status">
            当前展示演示家庭档案（API
            无绑定数据时）。身份切换与页面结构可先体验。
          </p>
        )}
        {loading && <p>加载中…</p>}

        <section className="child-overview">
          <div className="child-identity">
            <span className="community-avatar is-child is-large">
              {(selected?.displayName ?? DEMO_CHILD.name).slice(0, 1)}
            </span>
            <div>
              <h2>{selected?.displayName ?? DEMO_CHILD.name}</h2>
              <p>
                {DEMO_CHILD.className} · 已绑定 {students.length || 1} 个孩子
              </p>
            </div>
          </div>
          <div className="child-status-grid">
            <article>
              <span>课程</span>
              <strong>{DEMO_PARENT_GROWTH.stats.lessons}</strong>
              <small>完成主课</small>
            </article>
            <article>
              <span>作品</span>
              <strong>{DEMO_PARENT_GROWTH.stats.works}</strong>
              <small>老师已确认</small>
            </article>
            <article>
              <span>反馈</span>
              <strong>
                {growth?.publishedFeedback.length ??
                  DEMO_PARENT_GROWTH.stats.feedback}
              </strong>
              <small>家长可见</small>
            </article>
          </div>
        </section>

        <div className="child-content-grid">
          <section className="child-works">
            <div className="community-section-head">
              <h2>最近作品</h2>
            </div>
            <div className="child-work-grid">
              {DEMO_PARENT_GROWTH.works.map((work) => (
                <button key={work.id} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={work.image} alt={work.title} />
                  <span>
                    <b>{work.title}</b>
                    <small>
                      {work.lesson}　{work.status}
                    </small>
                  </span>
                </button>
              ))}
            </div>

            {students.length > 1 && (
              <>
                <div
                  className="community-section-head"
                  style={{ marginTop: 28 }}
                >
                  <h2>孩子切换</h2>
                </div>
                <div className="child-work-grid">
                  {students.map((student) => (
                    <button
                      key={student.studentProfileId}
                      type="button"
                      onClick={() =>
                        student.selected
                          ? undefined
                          : void switchStudent(student.studentProfileId)
                      }
                    >
                      <span>
                        <b>
                          {student.displayName}
                          {student.selected ? '（当前）' : ''}
                        </b>
                        <small>
                          {student.selected ? '正在查看' : '点击切换'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="community-section-head">
              <h2>课节与作品（亲子共学）</h2>
            </div>
            {learningError && <p role="alert">{learningError}</p>}
            {classes.length === 0 && !learningError && (
              <p>当前学生暂未加入班级；入班后课节会出现在这里。</p>
            )}
            {curriculum && (
              <>
                <p>
                  {curriculum.className} · {curriculum.coursePackageTitle} v
                  {curriculum.coursePackageVersion}
                </p>
                <ul style={{ paddingLeft: 18 }}>
                  {curriculum.lessons.map((lesson) => (
                    <li key={lesson.mainLessonId} style={{ marginBottom: 8 }}>
                      <b>
                        {lesson.sequence}. {lesson.title}
                      </b>{' '}
                      <small>
                        {lesson.track === 'AIGC' ? 'AIGC' : 'Vibe Coding'}
                        {lesson.submission
                          ? ` · 作品：${lesson.submission.status}`
                          : lesson.assignment
                            ? ' · 待提交'
                            : ''}
                      </small>
                      {lesson.submission &&
                      (lesson.submission.status === 'DRAFT' ||
                        lesson.submission.status === 'NEEDS_REVISION' ||
                        lesson.submission.status === 'RESUBMITTED' ||
                        lesson.submission.status === 'SUBMITTED') ? (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              void submitLesson(
                                lesson.submission!.id,
                                lesson.submission!.status === 'SUBMITTED'
                                  ? 'RESUBMITTED'
                                  : 'SUBMITTED',
                              )
                            }
                          >
                            {lesson.submission.status === 'SUBMITTED'
                              ? '重新提交'
                              : '提交作品'}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="community-section-head" style={{ marginTop: 28 }}>
              <h2>学科内容（小学/初中）</h2>
            </div>
            <p role="status">
              学科内容库接入中：数学、语文等各学科 AI
              理解课将按孩子的年级出现在这里。
            </p>
          </section>

          <section className="growth-timeline">
            <div className="community-section-head">
              <h2>成长时间线</h2>
            </div>
            <aside className="child-feedback">
              {DEMO_PARENT_GROWTH.timeline.map((item) => (
                <article key={item.date + item.title}>
                  <time>{item.date}</time>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
              {growth?.publishedFeedback.map((item) => (
                <article key={item.id}>
                  <time>
                    {item.publishedAt
                      ? new Date(item.publishedAt).toLocaleDateString('zh-CN')
                      : '—'}
                  </time>
                  <div>
                    <b>{item.lessonTitle}</b>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </aside>
          </section>

          <aside className="child-feedback">
            <div className="community-section-head">
              <h2>五维评价</h2>
            </div>
            <div className="growth-summary" style={{ marginBottom: 18 }}>
              {(
                growth?.confirmedEvaluations[0]?.scores ??
                DEMO_PARENT_GROWTH.dimensions
              ).map((score) => (
                <article key={score.dimension}>
                  <b>
                    {score.dimension} · {score.level} 级
                  </b>
                  <p>{score.rationale}</p>
                </article>
              ))}
            </div>

            <div className="community-section-head">
              <h2>阶段报告</h2>
            </div>
            {(growth?.publishedReports.length
              ? growth.publishedReports
              : [
                  {
                    id: 'demo-report',
                    milestone: DEMO_PARENT_GROWTH.report.milestone,
                    summary: DEMO_PARENT_GROWTH.report.summary,
                    teacherObservation:
                      DEMO_PARENT_GROWTH.report.teacherObservation,
                  },
                ]
            ).map((report) => (
              <article key={report.id}>
                <time>第{report.milestone}节</time>
                <div>
                  <b>{report.summary}</b>
                  {report.teacherObservation && (
                    <p>{report.teacherObservation}</p>
                  )}
                </div>
              </article>
            ))}

            <div className="parent-course-window">
              <div className="community-section-head">
                <h2>近期活动</h2>
                <span>可选报名</span>
              </div>
              <div>
                {DEMO_PARENT_GROWTH.events.map((event) => (
                  <article key={event.title}>
                    <span>活动</span>
                    <h3>{event.title}</h3>
                    <p>
                      {event.time} · {event.detail}
                    </p>
                    <b>预约</b>
                    <button type="button">登记参加</button>
                  </article>
                ))}
                <article>
                  <span>系统课</span>
                  <h3>AI 学期课</h3>
                  <p>16 节线下课与 8 节答疑，共 24 课时。</p>
                  <b>4480 元</b>
                  <button type="button">咨询顾问</button>
                </article>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </CommunityShell>
  );
}
