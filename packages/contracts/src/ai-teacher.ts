import { z } from 'zod';

export const aiTeacherMessageRoles = ['user', 'assistant', 'system'] as const;
export const aiTeacherMessageRoleSchema = z.enum(aiTeacherMessageRoles);
export type AiTeacherMessageRole = z.infer<typeof aiTeacherMessageRoleSchema>;

/** Max free-text length retained for dialogue minimization. */
export const AI_TEACHER_MAX_MESSAGE_CHARS = 800;
export const AI_TEACHER_MAX_HISTORY_MESSAGES = 12;

export const aiTeacherChatRequestSchema = z
  .object({
    classId: z.string().uuid(),
    mainLessonId: z.string().uuid(),
    message: z.string().trim().min(1).max(AI_TEACHER_MAX_MESSAGE_CHARS),
    conversationId: z.string().uuid().optional(),
  })
  .strict();

export type AiTeacherChatRequest = z.infer<typeof aiTeacherChatRequestSchema>;

export const aiTeacherChatResponseSchema = z
  .object({
    conversationId: z.string().uuid(),
    messageId: z.string().uuid(),
    role: z.literal('assistant'),
    content: z.string().min(1).max(AI_TEACHER_MAX_MESSAGE_CHARS),
    refusedHomework: z.boolean(),
    modelRoute: z.enum(['primary', 'fallback', 'mock']),
    degraded: z.boolean(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AiTeacherChatResponse = z.infer<typeof aiTeacherChatResponseSchema>;

export const aiGatewayReadinessSchema = z
  .object({
    ready: z.boolean(),
    provider: z.enum(['mock', 'remote', 'degraded']),
    degradedReasons: z.array(z.string()),
  })
  .strict();

export type AiGatewayReadiness = z.infer<typeof aiGatewayReadinessSchema>;

const homeworkProxyPatterns = [
  /帮我.*?(写|完成|交).*?(作业|作品|代码|答案)/,
  /直接(给|写|生成).*(完整|全部).*(答案|代码|作业)/,
  /代(写|做|交)/,
  /完整(作业|答案|代码).*(给我|发给我)/,
  /替我(完成|写|做)/,
  /do\s+my\s+homework/i,
  /write\s+(the\s+)?(entire|complete|full)\s+(code|assignment|homework)/i,
];

export function detectsHomeworkProxyRequest(message: string): boolean {
  const normalized = message.trim();
  return homeworkProxyPatterns.some((pattern) => pattern.test(normalized));
}

export const AI_TEACHER_HOMEWORK_REFUSAL =
  '我不能替你完成整份作业或直接给出完整答案。我们可以一起拆解任务：先明确目标，再讨论提示词、步骤或示例片段，由你自己完成创作。';

export function buildAiTeacherSystemPrompt(context: {
  courseTitle: string;
  lessonTitle: string;
  lessonTheme: string;
  assignmentTitle: string;
  assignmentRequirements: string;
  track: 'AIGC' | 'VIBE_CODING';
}): string {
  return [
    '你是星芽 AI 老师，只辅导当前课程任务，不做全学科答疑。',
    `课程：${context.courseTitle}`,
    `课节：${context.lessonTitle}（${context.lessonTheme}）`,
    `赛道：${context.track}`,
    `作业：${context.assignmentTitle}`,
    `要求：${context.assignmentRequirements}`,
    '规则：拒绝完整代做；可提供拆解、提示词优化、概念解释、示例片段与检查清单。',
    '回复简洁，适合青少年，不输出未成年人敏感内容。',
  ].join('\n');
}

export function truncateAiTeacherMessage(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= AI_TEACHER_MAX_MESSAGE_CHARS) return trimmed;
  return `${trimmed.slice(0, AI_TEACHER_MAX_MESSAGE_CHARS - 1)}…`;
}
