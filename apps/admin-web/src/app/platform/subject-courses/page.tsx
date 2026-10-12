'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminApiClient, ApiRequestError } from '../../auth-client';
import { OpsShell } from '../../ops-shell';

type SubjectCourseSummary = {
  id: string;
  subject: string;
  gradeBand: string;
  gradeLevel: number;
  title: string;
  status: string;
  publishedAt: string | null;
  chapterCount: number;
};

const SUBJECTS = [
  ['MATH', '数学'],
  ['CHINESE', '语文'],
  ['ENGLISH', '英语'],
  ['PHYSICS', '物理'],
  ['CHEMISTRY', '化学'],
  ['BIOLOGY', '生物'],
  ['HISTORY', '历史'],
  ['GEOGRAPHY', '地理'],
  ['POLITICS', '道法'],
  ['OTHER', '其他'],
] as const;

const GRADE_BANDS = [
  ['PRIMARY', '小学'],
  ['JUNIOR_HIGH', '初中'],
] as const;

/**
 * 学科内容库（平台空间）：小学/初中各学科 HTML 章节内容的
 * 创建、编辑（草稿期）与发布。已发布不可改，改版建新记录（ADR-0003）。
 */
export default function SubjectCoursesPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [courses, setCourses] = useState<SubjectCourseSummary[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subject, setSubject] = useState('MATH');
  const [gradeBand, setGradeBand] = useState('PRIMARY');
  const [gradeLevel, setGradeLevel] = useState(3);
  const [title, setTitle] = useState('');
  const [chapterTitle, setChapterTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      setCourses(await client.listSubjectCourses());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '列表加载失败');
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!title.trim() || !chapterTitle.trim()) {
      setError('请填写内容标题和第一章标题');
      return;
    }
    try {
      await client.createSubjectCourse({
        subject,
        gradeBand,
        gradeLevel,
        title: title.trim(),
        chapters: [
          {
            sequence: 1,
            title: chapterTitle.trim(),
            contentHtml,
          },
        ],
      });
      setNotice('草稿已创建；可在后续编辑中继续补章节，发布后不可修改。');
      setTitle('');
      setChapterTitle('');
      setContentHtml('');
      await reload();
    } catch (cause) {
      setError(
        cause instanceof ApiRequestError ? cause.message : '创建失败，请重试',
      );
    }
  }

  async function handlePublish(id: string) {
    setError('');
    try {
      await client.publishSubjectCourse(id);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '发布失败');
    }
  }

  return (
    <OpsShell active="platform" displayName="平台管理员" roleLabel="平台治理">
      <section className="admin-section">
        <div className="admin-section-head">
          <h2>学科内容库</h2>
          <p>
            小学/初中各学科 AI 理解内容：HTML 章节 + AI
            引导提示。发布后不可修改。
          </p>
        </div>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}

        <form onSubmit={(event) => void handleCreate(event)}>
          <h3>新建学科内容（草稿）</h3>
          <label>
            学科
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            >
              {SUBJECTS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            学段
            <select
              value={gradeBand}
              onChange={(event) => setGradeBand(event.target.value)}
            >
              {GRADE_BANDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            年级（1-9）
            <input
              type="number"
              min={1}
              max={9}
              value={gradeLevel}
              onChange={(event) => setGradeLevel(Number(event.target.value))}
            />
          </label>
          <label>
            内容标题
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="如：三年级数学上册"
            />
          </label>
          <label>
            第一章标题
            <input
              value={chapterTitle}
              onChange={(event) => setChapterTitle(event.target.value)}
              placeholder="如：时分秒"
            />
          </label>
          <label>
            第一章 HTML 内容（课程正文占位；图片请走对象存储后引用 URL）
            <textarea
              rows={6}
              value={contentHtml}
              onChange={(event) => setContentHtml(event.target.value)}
              placeholder="<p>章节正文 HTML……</p>"
            />
          </label>
          <button type="submit">创建草稿</button>
        </form>

        <h3>已录入内容</h3>
        {courses.length === 0 ? (
          <p>还没有学科内容；创建草稿后即可导入课程 HTML。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>标题</th>
                <th>学科</th>
                <th>学段/年级</th>
                <th>状态</th>
                <th>章节数</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>{course.title}</td>
                  <td>{course.subject}</td>
                  <td>
                    {course.gradeBand === 'PRIMARY' ? '小学' : '初中'} ·{' '}
                    {course.gradeLevel}
                  </td>
                  <td>{course.status}</td>
                  <td>{course.chapterCount}</td>
                  <td>
                    {course.status === 'DRAFT' && (
                      <button
                        type="button"
                        onClick={() => void handlePublish(course.id)}
                      >
                        发布
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </OpsShell>
  );
}
