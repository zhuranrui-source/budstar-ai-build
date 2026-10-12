import type { CreateCoursePackageVersionInput } from '@budstar/contracts';

const fiveDimensions = [
  {
    key: 'problem_discovery',
    label: '问题发现',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'ai_collaboration',
    label: 'AI 协作',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'creative_expression',
    label: '创意表达',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'technical_implementation',
    label: '技术实现',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'iterative_reflection',
    label: '迭代反思',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
];

const mainLessonSkeleton: Array<{
  track: 'AIGC' | 'VIBE_CODING';
  title: string;
  theme: string;
  coreDeliverable: string;
}> = [
  {
    track: 'AIGC',
    title: 'AI 创作认知与安全边界',
    theme: '认识 AI 创作边界',
    coreDeliverable: '我的 AI 创作规则卡',
  },
  {
    track: 'AIGC',
    title: '创意策划与故事设定',
    theme: '角色与世界观',
    coreDeliverable: '角色/世界观/故事概念卡',
  },
  {
    track: 'AIGC',
    title: '提示词表达与迭代',
    theme: '提示词工程',
    coreDeliverable: '高质量提示词卡与迭代记录',
  },
  {
    track: 'AIGC',
    title: 'AI 生图与视觉风格',
    theme: '视觉风格',
    coreDeliverable: '主题海报或角色视觉图',
  },
  {
    track: 'AIGC',
    title: '分镜与镜头语言',
    theme: '分镜表达',
    coreDeliverable: '6-8 格故事分镜',
  },
  {
    track: 'AIGC',
    title: 'AI 生视频与素材组织',
    theme: '视频素材',
    coreDeliverable: '短视频片段或视频链接',
  },
  {
    track: 'AIGC',
    title: 'AI 短片/广告片包装',
    theme: '成片包装',
    coreDeliverable: 'AI 短片、广告片或故事预告片',
  },
  {
    track: 'AIGC',
    title: 'Agent 导演与创作展示',
    theme: '阶段展示',
    coreDeliverable: 'AIGC 阶段作品集精选',
  },
  {
    track: 'VIBE_CODING',
    title: '需求表达与产品思维',
    theme: '产品需求',
    coreDeliverable: '项目需求卡与用户故事',
  },
  {
    track: 'VIBE_CODING',
    title: '前端页面与交互原型',
    theme: '页面原型',
    coreDeliverable: 'Web 页面原型或组件页面',
  },
  {
    track: 'VIBE_CODING',
    title: 'AI 编程工具与项目脚手架',
    theme: '项目脚手架',
    coreDeliverable: '初始项目仓库与第一次提交',
  },
  {
    track: 'VIBE_CODING',
    title: 'GitHub / CLI / README / 版本迭代',
    theme: '版本协作',
    coreDeliverable: 'GitHub 仓库、README、至少 3 次有效 commit',
  },
  {
    track: 'VIBE_CODING',
    title: '外部 API 与服务端概念',
    theme: '外部 API',
    coreDeliverable: '调用外部 API 的动态页面',
  },
  {
    track: 'VIBE_CODING',
    title: 'BaaS 数据存储与列表读写',
    theme: '数据存储',
    coreDeliverable: '带数据存储的功能 Demo',
  },
  {
    track: 'VIBE_CODING',
    title: 'Agent 架构与 MCP/Tools 体验',
    theme: '工具调用',
    coreDeliverable: '带工具调用概念的应用设计或 Demo',
  },
  {
    track: 'VIBE_CODING',
    title: '完整应用开发与上线展示',
    theme: '最终展示',
    coreDeliverable: '可运行最终项目、演示链接、复盘说明',
  },
];

const qaSkeleton: Array<{ afterLessonSequence: number; title: string }> = [
  { afterLessonSequence: 2, title: '创意策划与提示词答疑' },
  { afterLessonSequence: 4, title: '生图质量、风格一致性与阶段报告答疑' },
  { afterLessonSequence: 6, title: '分镜、生视频与素材组织答疑' },
  { afterLessonSequence: 8, title: 'AIGC 作品集展示与优化答疑' },
  { afterLessonSequence: 10, title: '需求表达、页面结构与交互答疑' },
  { afterLessonSequence: 12, title: 'GitHub、README、commit 与版本迭代答疑' },
  { afterLessonSequence: 14, title: 'API、BaaS、数据读写答疑' },
  { afterLessonSequence: 16, title: '最终项目上线展示与路演彩排' },
];

export function buildXingyaSeedPackageDraft(
  version = '1.0.0',
): CreateCoursePackageVersionInput {
  return {
    packageKey: 'ai-xingya-seed',
    version,
    title: 'AI 星芽种子实验班',
    mainLessons: mainLessonSkeleton.map((lesson, index) => {
      const sequence = index + 1;
      return {
        sequence,
        track: lesson.track,
        title: lesson.title,
        theme: lesson.theme,
        coreDeliverable: lesson.coreDeliverable,
        learningGoals: `完成第 ${sequence} 节主题学习并提交核心产出`,
        assignment: {
          title: `${lesson.title} 作业`,
          requirements: `提交：${lesson.coreDeliverable}`,
          submissionKinds:
            lesson.track === 'AIGC'
              ? ['IMAGE', 'LINK', 'TEXT']
              : ['GITHUB', 'DEMO_LINK', 'TEXT'],
        },
      };
    }),
    onlineQaSessions: qaSkeleton.map((session, index) => ({
      sequence: index + 1,
      afterLessonSequence: session.afterLessonSequence,
      title: session.title,
      topic: session.title,
    })),
    rubrics: [
      {
        name: '五维成长评价',
        dimensions: fiveDimensions,
      },
    ],
  };
}
