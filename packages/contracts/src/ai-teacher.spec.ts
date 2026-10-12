import { describe, expect, it } from 'vitest';
import {
  AI_TEACHER_HOMEWORK_REFUSAL,
  aiTeacherChatRequestSchema,
  buildAiTeacherSystemPrompt,
  detectsHomeworkProxyRequest,
  truncateAiTeacherMessage,
  AI_TEACHER_MAX_MESSAGE_CHARS,
} from './ai-teacher';

describe('ai-teacher contract', () => {
  it('accepts chat requests bound to class and lesson', () => {
    expect(
      aiTeacherChatRequestSchema.safeParse({
        classId: '11111111-1111-4111-8111-111111111111',
        mainLessonId: '22222222-2222-4222-8222-222222222222',
        message: '怎样优化提示词？',
      }).success,
    ).toBe(true);
    expect(
      aiTeacherChatRequestSchema.safeParse({
        classId: '11111111-1111-4111-8111-111111111111',
        mainLessonId: '22222222-2222-4222-8222-222222222222',
        message: '',
      }).success,
    ).toBe(false);
  });

  it('detects homework proxy requests for prompt regression', () => {
    expect(detectsHomeworkProxyRequest('请帮我写完整作业答案')).toBe(true);
    expect(detectsHomeworkProxyRequest('直接给我完整代码')).toBe(true);
    expect(detectsHomeworkProxyRequest('替我完成作品')).toBe(true);
    expect(detectsHomeworkProxyRequest('Please do my homework')).toBe(true);
    expect(detectsHomeworkProxyRequest('怎样拆解这个任务？')).toBe(false);
    expect(detectsHomeworkProxyRequest('GitHub README 要写什么？')).toBe(false);
  });

  it('builds system prompt with course and assignment context', () => {
    const prompt = buildAiTeacherSystemPrompt({
      courseTitle: 'AI 星芽种子实验班',
      lessonTitle: '第 1 课',
      lessonTheme: '认识提示词',
      assignmentTitle: '提示词作品',
      assignmentRequirements: '提交标题与说明',
      track: 'AIGC',
    });
    expect(prompt).toContain('星芽 AI 老师');
    expect(prompt).toContain('拒绝完整代做');
    expect(prompt).toContain('提示词作品');
    expect(AI_TEACHER_HOMEWORK_REFUSAL).toContain('不能替你完成');
  });

  it('truncates messages for minimal dialogue storage', () => {
    const long = '啊'.repeat(AI_TEACHER_MAX_MESSAGE_CHARS + 20);
    const truncated = truncateAiTeacherMessage(long);
    expect(truncated.length).toBe(AI_TEACHER_MAX_MESSAGE_CHARS);
    expect(truncated.endsWith('…')).toBe(true);
  });
});
