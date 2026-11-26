import type { WechatSession } from './api';

export const PREVIEW_MODE = process.env.TARO_APP_PREVIEW_MODE === 'true';
export const PREVIEW_ACCESS_TOKEN = 'budstar-preview-token';

export const PREVIEW_SESSION: WechatSession = {
  accessToken: PREVIEW_ACCESS_TOKEN,
  accessTokenExpiresAt: '2099-12-31T23:59:59.000Z',
  actor: {
    kind: 'parent',
    userAccountId: 'parent-preview',
    displayName: '星芽家长',
  },
  availableIdentities: ['parent'],
  activeIdentity: 'parent',
  campuses: [],
};

type PreviewOptions = {
  method?: string;
  body?: unknown;
};

type PreviewSubmission = {
  id: string;
  status:
    'DRAFT' | 'SUBMITTED' | 'NEEDS_REVISION' | 'RESUBMITTED' | 'COMPLETED';
  updatedAt: string;
};

const students = [
  {
    studentProfileId: 'preview-student-1',
    displayName: '小星',
    campusId: 'preview-campus',
    bindingId: 'preview-binding-1',
  },
  {
    studentProfileId: 'preview-student-2',
    displayName: '小芽',
    campusId: 'preview-campus',
    bindingId: 'preview-binding-2',
  },
];

let selectedStudentProfileId = students[0].studentProfileId;

const submissions = new Map<string, PreviewSubmission>([
  [
    'preview-lesson-2',
    {
      id: 'preview-submission-2',
      status: 'DRAFT',
      updatedAt: '2026-11-08T08:20:00.000Z',
    },
  ],
  [
    'preview-lesson-3',
    {
      id: 'preview-submission-3',
      status: 'NEEDS_REVISION',
      updatedAt: '2026-11-07T10:30:00.000Z',
    },
  ],
  [
    'preview-lesson-4',
    {
      id: 'preview-submission-4',
      status: 'COMPLETED',
      updatedAt: '2026-11-05T12:00:00.000Z',
    },
  ],
]);

const subjectCourses = [
  {
    id: 'preview-course-1',
    subject: 'MATH',
    gradeBand: 'PRIMARY',
    gradeLevel: 5,
    title: '图形中的数学秘密',
    status: 'PUBLISHED',
    publishedAt: '2026-10-18T08:00:00.000Z',
    chapterCount: 8,
  },
  {
    id: 'preview-course-2',
    subject: 'PHYSICS',
    gradeBand: 'JUNIOR_HIGH',
    gradeLevel: 8,
    title: '光与声音互动实验',
    status: 'PUBLISHED',
    publishedAt: '2026-10-20T08:00:00.000Z',
    chapterCount: 6,
  },
  {
    id: 'preview-course-3',
    subject: 'CHINESE',
    gradeBand: 'PRIMARY',
    gradeLevel: 4,
    title: '古诗里的四季',
    status: 'PUBLISHED',
    publishedAt: '2026-10-22T08:00:00.000Z',
    chapterCount: 5,
  },
];

const chapterTitles: Record<string, string[]> = {
  'preview-course-1': [
    '从身边寻找图形',
    '对称藏在哪里',
    '面积可以这样比较',
    '用角度描述方向',
    '图形的平移与旋转',
    '搭建稳定的结构',
    '设计一座未来公园',
    '展示与复盘',
  ],
  'preview-course-2': [
    '声音从哪里来',
    '看见声音的振动',
    '光沿什么方向传播',
    '镜子里的规律',
    '设计简易潜望镜',
    '完成实验报告',
  ],
  'preview-course-3': [
    '寻找诗里的春天',
    '听见夏日的声音',
    '读懂秋天的颜色',
    '感受冬日的留白',
    '创作我的四季小诗',
  ],
};

function subjectCourseDetail(courseId: string) {
  const course = subjectCourses.find((item) => item.id === courseId);
  if (!course) return null;
  return {
    ...course,
    chapters: (chapterTitles[courseId] ?? []).map((title, index) => ({
      id: `${courseId}-chapter-${index + 1}`,
      sequence: index + 1,
      title,
      contentHtml: `<div><h2>${title}</h2><p>这一章从一个真实问题开始，通过观察、比较和动手尝试找到规律。</p><h3>本章任务</h3><ul><li>记录你最先发现的现象</li><li>尝试至少两种不同方法</li><li>用自己的话解释结论</li></ul><h3>想一想</h3><p>如果改变一个条件，结果会发生什么变化？把你的猜想写下来，再通过实验验证。</p><blockquote>星芽提示：先说出你的判断，再寻找证据。</blockquote></div>`,
      contentUrl: null,
      aiGuidePrompt: null,
      aiContext: null,
    })),
  };
}

const planetPosts = [
  {
    id: 'preview-post-1',
    title: '会讲故事的四季绘本',
    body: '把四季里的颜色、声音和想象整理成了一本会讲故事的互动绘本。',
    visibilityScope: 'FAMILY',
    studentDisplayName: '小星',
    publishedAt: '2026-11-09T02:30:00.000Z',
  },
  {
    id: 'preview-post-2',
    title: '我的第一台天气记录仪',
    body: '从每天的天气观察出发，完成记录、比较和可视化表达。',
    visibilityScope: 'CLASS',
    studentDisplayName: '小芽',
    publishedAt: '2026-11-08T09:15:00.000Z',
  },
  {
    id: 'preview-post-3',
    title: '城市节水小助手',
    body: '孩子们一起寻找生活中的用水问题，并设计了自己的节水建议。',
    visibilityScope: 'CAMPUS',
    studentDisplayName: '小星',
    publishedAt: '2026-11-06T06:10:00.000Z',
  },
];

function curriculum(classId: string) {
  return {
    classId,
    className: classId === 'preview-class-2' ? '周末创想班' : '未来探索一班',
    coursePackageTitle:
      classId === 'preview-class-2' ? '创意编程进阶' : 'AI 创想启蒙',
    coursePackageVersion: '2026 秋季版',
    lessons: [
      {
        mainLessonId: 'preview-lesson-1',
        sequence: 1,
        title: '认识生成式人工智能',
        track: 'AIGC',
        theme: 'AI 初体验',
        assignment: {
          title: '制作一张未来城市海报',
          requirements: '提交作品图或链接，并用两句话说明你的创作思路。',
          submissionKinds: ['IMAGE', 'LINK'],
        },
        submission: submissions.get('preview-lesson-1') ?? null,
      },
      {
        mainLessonId: 'preview-lesson-2',
        sequence: 2,
        title: '让网页回应你的想法',
        track: 'VIBE_CODING',
        theme: '互动网页',
        assignment: {
          title: '完成个人介绍网页',
          requirements: '提交 GitHub 仓库和可访问的在线演示地址。',
          submissionKinds: ['GITHUB', 'LINK'],
        },
        submission: submissions.get('preview-lesson-2') ?? null,
      },
      {
        mainLessonId: 'preview-lesson-3',
        sequence: 3,
        title: '设计环保小助手',
        track: 'AIGC',
        theme: '可持续生活',
        assignment: {
          title: '完善环保助手方案',
          requirements: '结合老师反馈，补充方案细节后重新提交。',
          submissionKinds: ['IMAGE', 'LINK'],
        },
        submission: submissions.get('preview-lesson-3') ?? null,
      },
      {
        mainLessonId: 'preview-lesson-4',
        sequence: 4,
        title: '作品分享与复盘',
        track: 'AIGC',
        theme: '表达与反思',
        assignment: {
          title: '完成阶段作品总结',
          requirements: '回顾创作过程，并说明一次重要修改。',
          submissionKinds: ['TEXT'],
        },
        submission: submissions.get('preview-lesson-4') ?? null,
      },
      {
        mainLessonId: 'preview-lesson-5',
        sequence: 5,
        title: '团队创意工作坊',
        track: 'AIGC',
        theme: '协作创新',
        assignment: null,
        submission: null,
      },
    ],
  };
}

function submissionById(id: string): PreviewSubmission | undefined {
  return [...submissions.values()].find((submission) => submission.id === id);
}

export async function previewRequest<T>(
  path: string,
  options: PreviewOptions = {},
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120));

  if (path === '/family/students' && options.method !== 'POST') {
    return { students, selectedStudentProfileId } as T;
  }
  if (path === '/family/active-student' && options.method === 'POST') {
    const body = options.body as { studentProfileId?: string };
    if (
      students.some(
        (student) => student.studentProfileId === body.studentProfileId,
      )
    ) {
      selectedStudentProfileId = body.studentProfileId!;
    }
    return { students, selectedStudentProfileId } as T;
  }
  if (/^\/family\/students\/[^/]+\/classes$/.test(path)) {
    return [
      {
        classId: 'preview-class-1',
        className: '未来探索一班',
        status: 'ACTIVE',
      },
      { classId: 'preview-class-2', className: '周末创想班', status: 'ACTIVE' },
    ] as T;
  }
  const curriculumMatch = path.match(
    /^\/family\/students\/[^/]+\/classes\/([^/]+)\/lessons$/,
  );
  if (curriculumMatch) return curriculum(curriculumMatch[1]) as T;
  if (path === '/family/subject-courses') return subjectCourses as T;
  const subjectCourseMatch = path.match(/^\/family\/subject-courses\/([^/]+)$/);
  if (subjectCourseMatch) {
    const detail = subjectCourseDetail(
      decodeURIComponent(subjectCourseMatch[1]),
    );
    if (!detail) throw new Error('学科内容不存在或已下架');
    return detail as T;
  }
  if (path === '/family/planet/feed') return planetPosts as T;
  if (/^\/family\/growth\/[^/]+$/.test(path)) {
    return {
      publishedReports: [
        {
          id: 'preview-report-1',
          milestone: 4,
          summary: '能够主动拆解问题，并使用图文清楚表达自己的设计思路。',
          teacherObservation:
            '本阶段在团队讨论中更加主动，建议继续练习公开分享。',
        },
      ],
      confirmedEvaluations: [
        {
          scores: [
            { dimension: '创造力', rationale: '能够提出多种不同方案' },
            { dimension: '表达力', rationale: '作品结构清晰' },
          ],
        },
      ],
    } as T;
  }
  if (
    /^\/family\/students\/[^/]+\/submissions\/draft$/.test(path) &&
    options.method === 'PUT'
  ) {
    const body = options.body as { mainLessonId: string };
    const existing = submissions.get(body.mainLessonId);
    const saved = existing ?? {
      id: `preview-submission-${body.mainLessonId}`,
      status: 'DRAFT' as const,
      updatedAt: new Date().toISOString(),
    };
    submissions.set(body.mainLessonId, saved);
    return { id: saved.id } as T;
  }
  const transitionMatch = path.match(
    /^\/family\/students\/[^/]+\/submissions\/([^/]+)\/transitions$/,
  );
  if (transitionMatch && options.method === 'POST') {
    const submission = submissionById(transitionMatch[1]);
    const body = options.body as {
      toStatus: 'SUBMITTED' | 'RESUBMITTED';
    };
    if (submission) {
      submission.status = body.toStatus;
      submission.updatedAt = new Date().toISOString();
    }
    return { ok: true } as T;
  }
  if (path === '/family/bindings' && options.method === 'POST') {
    return { ok: true } as T;
  }
  if (path === '/auth/wechat/bind-phone' && options.method === 'POST') {
    return PREVIEW_SESSION as T;
  }

  throw new Error(`预览模式暂不支持该请求：${path}`);
}
