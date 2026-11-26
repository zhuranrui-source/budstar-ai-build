'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  SubjectCourseDetail,
  SubjectCourseSummary,
} from '@budstar/contracts';
import { CommunityShell } from '../community-shell';
import { API_BASE_URL, MEDIA_ORIGIN } from '../planet/planet-api';

const SUBJECTS: Array<{
  id: string;
  label: string;
  intro: string;
  tone: string;
}> = [
  {
    id: 'MATH',
    label: '数学',
    intro: '把抽象的数、式、图形变成可以拖动和观察的模型，在操作里理解规律。',
    tone: 'math',
  },
  {
    id: 'PHYSICS',
    label: '物理',
    intro: '改变一个变量，立刻看到结果：光怎么走、力怎么变、电路怎么通。',
    tone: 'physics',
  },
  {
    id: 'CHEMISTRY',
    label: '化学',
    intro: '在安全的虚拟实验台上反复做实验，看清反应前后发生了什么。',
    tone: 'chemistry',
  },
  {
    id: 'BIOLOGY',
    label: '生物',
    intro: '从调节、生态到生物技术，用动态过程理解生命系统。',
    tone: 'biology',
  },
  {
    id: 'CHINESE',
    label: '语文',
    intro: '听、读、看结合的古诗互动诵读，感受诗句里的画面和节奏。',
    tone: 'chinese',
  },
  {
    id: 'ENGLISH',
    label: '英语',
    intro: '从字母音标到时态从句，带发音的互动讲解，适合反复练习。',
    tone: 'english',
  },
];

const BAND_LABEL: Record<string, string> = {
  PRIMARY: '小学',
  JUNIOR_HIGH: '初中',
  SENIOR_HIGH: '高中',
  GENERAL: '小学–初中',
};

/** 导航类页面不算知识点。 */
const NAV_CHAPTERS = new Set([
  '开始使用',
  '实验室导航',
  '开始阅读',
  '音色库试听',
]);

const BAND_ORDER = ['PRIMARY', 'GENERAL', 'JUNIOR_HIGH', 'SENIOR_HIGH'];

function contentHref(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : `${MEDIA_ORIGIN}${url}`;
}

export default function LabPage() {
  const [courses, setCourses] = useState<SubjectCourseSummary[]>([]);
  const [subject, setSubject] = useState('MATH');
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, SubjectCourseDetail>>(
    {},
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/public/subject-courses`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('加载失败'))))
      .then((items: SubjectCourseSummary[]) => setCourses(items))
      .catch(() => setError('实验室加载失败，请稍后刷新重试'))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, { courses: number; chapters: number }> = {};
    for (const c of courses) {
      map[c.subject] ??= { courses: 0, chapters: 0 };
      map[c.subject].courses += 1;
      map[c.subject].chapters += c.chapterCount;
    }
    return map;
  }, [courses]);

  const visible = useMemo(
    () =>
      courses
        .filter((c) => c.subject === subject)
        .sort(
          (a, b) =>
            BAND_ORDER.indexOf(a.gradeBand) - BAND_ORDER.indexOf(b.gradeBand) ||
            a.title.localeCompare(b.title, 'zh-CN'),
        ),
    [courses, subject],
  );

  async function toggle(id: string) {
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (details[id]) return;
    try {
      const r = await fetch(`${API_BASE_URL}/public/subject-courses/${id}`);
      if (!r.ok) throw new Error();
      const detail = (await r.json()) as SubjectCourseDetail;
      setDetails((d) => ({ ...d, [id]: detail }));
    } catch {
      setError('课程章节加载失败，请重试');
    }
  }

  const current = SUBJECTS.find((s) => s.id === subject)!;
  const total = courses.reduce((n, c) => n + c.chapterCount, 0);

  return (
    <CommunityShell active="lab">
      <section className="lab2">
        <header className="lab2-hero">
          <span>K12 INTERACTIVE LAB</span>
          <h1>互动实验室</h1>
          <p>
            {courses.length
              ? `${SUBJECTS.length} 个学科 · ${courses.length} 门课程 · ${total} 个互动知识点。`
              : ''}
            每个知识点都是一个可以拖一拖、点一点的互动页面，打开就能动手。
          </p>
        </header>

        <nav className="lab2-subjects" aria-label="选择学科">
          {SUBJECTS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`is-${s.tone}${subject === s.id ? ' is-active' : ''}`}
              onClick={() => {
                setSubject(s.id);
                setOpenId(null);
              }}
            >
              <b>{s.label}</b>
              <small>
                {counts[s.id] ? `${counts[s.id].chapters} 个知识点` : '—'}
              </small>
            </button>
          ))}
        </nav>

        <p className="lab2-intro">{current.intro}</p>
        {error && (
          <p className="planet2-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="planet2-loading">正在加载…</p>}

        <div className="lab2-courses">
          {visible.map((course) => {
            const detail = details[course.id];
            const open = openId === course.id;
            return (
              <article
                key={course.id}
                className={`lab2-course is-${current.tone}${open ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="lab2-course-head"
                  onClick={() => void toggle(course.id)}
                  aria-expanded={open}
                >
                  <span className="lab2-badge">
                    {BAND_LABEL[course.gradeBand] ?? ''}
                  </span>
                  <h2>{course.title}</h2>
                  <small>{course.chapterCount} 个互动页面</small>
                  <em>{open ? '收起' : '展开知识点'}</em>
                </button>
                {open && (
                  <ol className="lab2-chapters">
                    {!detail ? (
                      <li className="lab2-muted">正在加载…</li>
                    ) : (
                      detail.chapters
                        .slice()
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((chapter) => {
                          const href = contentHref(chapter.contentUrl);
                          const isNav = NAV_CHAPTERS.has(chapter.title);
                          return (
                            <li
                              key={chapter.id}
                              className={isNav ? 'is-nav' : undefined}
                            >
                              {href ? (
                                <a href={href} target="_blank" rel="noreferrer">
                                  <span>{chapter.title}</span>
                                  <i>打开实验 ↗</i>
                                </a>
                              ) : (
                                <span>{chapter.title}</span>
                              )}
                            </li>
                          );
                        })
                    )}
                  </ol>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </CommunityShell>
  );
}
