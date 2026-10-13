'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminApiClient } from '../auth-client';

type CourseSummary = {
  id: string;
  title: string;
  mainLessonCount?: number;
};

type SubjectCourse = {
  id: string;
  subject: string;
  gradeBand: string;
  gradeLevel: number | null;
  title: string;
  chapterCount: number;
};

const SUBJECT_LABELS: Record<string, string> = {
  MATH: '数学',
  CHINESE: '语文',
  ENGLISH: '英语',
  PHYSICS: '物理',
  CHEMISTRY: '化学',
  BIOLOGY: '生物',
  OTHER: '其他',
};

const GRADE_LABELS: Record<string, string> = {
  PRIMARY: '小学',
  JUNIOR_HIGH: '初中',
  SENIOR_HIGH: '高中',
  GENERAL: '全学段',
};

/**
 * 合作方内容门户（ADR-0009/0010）：
 * 仅已发布课程与活动内容，不含学生数据、预约线索和校区运营数据。
 * 本页不依赖员工端组件（OpsShell 等），保持 ISSUE-06 拆分边界。
 */
export default function PartnerPortalPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectCourse[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      try {
        const [aiCourses, subjectCourses] = await Promise.all([
          client.getPartnerCourses(),
          client.getPartnerSubjectCourses(),
        ]);
        setCourses(aiCourses);
        setSubjects(subjectCourses);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '内容加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [client]);

  async function handleLogout() {
    await client.logout();
    window.location.replace('/');
  }

  return (
    <main className="partner-portal">
      <header className="partner-head">
        <div>
          <h1>BudStar 合作方内容门户</h1>
          <p>已发布课程与学科内容 · 用于经营自有生源</p>
        </div>
        <button type="button" onClick={() => void handleLogout()}>
          退出登录
        </button>
      </header>

      {error && <p role="alert">{error}</p>}
      {loading && <p>加载中…</p>}

      <section>
        <h2>学科互动实验室</h2>
        {subjects.length === 0 ? (
          <p>暂无已发布的学科内容。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>学科</th>
                <th>内容</th>
                <th>学段</th>
                <th>章节数</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((course) => (
                <tr key={course.id}>
                  <td>{SUBJECT_LABELS[course.subject] ?? course.subject}</td>
                  <td>{course.title}</td>
                  <td>
                    {GRADE_LABELS[course.gradeBand] ?? course.gradeBand}
                    {course.gradeLevel ? ` ${course.gradeLevel} 年级` : ''}
                  </td>
                  <td>{course.chapterCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>AI 课程包</h2>
        {courses.length === 0 ? (
          <p>暂无已发布的 AI 课程包。</p>
        ) : (
          <ul>
            {courses.map((course) => (
              <li key={course.id}>
                {course.title}
                {course.mainLessonCount
                  ? ` · ${course.mainLessonCount} 主课`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
