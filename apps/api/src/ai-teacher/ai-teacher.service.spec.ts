import {
  DegradedAiGatewayAdapter,
  MockAiGatewayAdapter,
  RemoteAiGatewayAdapter,
} from './ai-gateway.adapters';
import { resolveAiGatewayAdapter } from './ai-gateway.boundaries';
import { AiTeacherService, InMemoryAiTeacherStore } from './ai-teacher.service';
import { InMemorySubmissionStore } from '../submissions/submissions.service';

describe('ai teacher', () => {
  const studentId = '33333333-3333-4333-8333-333333333333';
  const classId = '44444444-4444-4444-8444-444444444444';
  const lessonId = '55555555-5555-4555-8555-555555555555';
  const assignmentId = '66666666-6666-4666-8666-666666666666';
  const versionId = '77777777-7777-4777-8777-777777777777';

  function createService(gateway = new MockAiGatewayAdapter()) {
    const submissionStore = new InMemorySubmissionStore();
    submissionStore.seedStudent({
      id: studentId,
      campusId: 'campus-a',
      displayName: '小星',
    });
    submissionStore.seedClass(
      {
        id: classId,
        campusId: 'campus-a',
        name: '南山一班',
        classCode: 'BSAB12CD',
        status: 'ACTIVE',
        coursePackageVersionId: versionId,
        coursePackageTitle: 'AI 星芽种子实验班',
        coursePackageVersion: '1.0.0',
      },
      [
        {
          id: lessonId,
          sequence: 1,
          track: 'AIGC',
          title: '第 1 课',
          theme: '提示词',
          coreDeliverable: '海报',
          learningGoals: '学会提示词',
          assignment: {
            id: assignmentId,
            title: '提示词作品',
            requirements: '提交标题说明与图片',
            submissionKinds: ['image', 'link'],
          },
        },
      ],
    );
    void submissionStore.saveMembership({
      classId,
      campusId: 'campus-a',
      studentProfileId: studentId,
      joinedAt: new Date(),
    });
    const conversations = new InMemoryAiTeacherStore();
    return {
      conversations,
      service: new AiTeacherService(gateway, conversations, submissionStore),
    };
  }

  it('injects course context and refuses homework proxy requests', async () => {
    const { service, conversations } = createService();
    const coaching = await service.chat(studentId, {
      classId,
      mainLessonId: lessonId,
      message: '怎样优化提示词？',
    });
    expect(coaching.refusedHomework).toBe(false);
    expect(coaching.content).toContain('一步步');

    const refused = await service.chat(studentId, {
      classId,
      mainLessonId: lessonId,
      conversationId: coaching.conversationId,
      message: '请帮我写完整作业答案',
    });
    expect(refused.refusedHomework).toBe(true);
    expect(refused.content).toContain('不能替你完成');

    const stored = await conversations.findConversation(
      coaching.conversationId,
    );
    expect(stored?.messages.every((item) => item.content.length <= 800)).toBe(
      true,
    );
  });

  it('fail-closes production remote AI without config and degrades locally', () => {
    expect(() =>
      resolveAiGatewayAdapter(
        {
          nodeEnv: 'production',
          provider: 'remote',
        },
        {
          createMock: () => new MockAiGatewayAdapter(),
          createRemote: () => {
            throw new Error('unused');
          },
          createDegraded: (reasons) => new DegradedAiGatewayAdapter(reasons),
        },
      ),
    ).toThrow(/fail-closed/);

    const degraded = resolveAiGatewayAdapter(
      {
        nodeEnv: 'test',
        provider: 'remote',
      },
      {
        createMock: () => new MockAiGatewayAdapter(),
        createRemote: () => {
          throw new Error('unused');
        },
        createDegraded: (reasons) => new DegradedAiGatewayAdapter(reasons),
      },
    );
    expect(degraded.readiness().ready).toBe(false);
  });

  it('routes to fallback when primary transport fails', async () => {
    const adapter = new RemoteAiGatewayAdapter(
      {
        primaryApiKey: 'pk',
        fallbackApiKey: 'fk',
        primaryEndpoint: 'https://primary.example',
        fallbackEndpoint: 'https://fallback.example',
      },
      (endpoint) => {
        if (endpoint.includes('primary')) {
          return Promise.reject(new Error('down'));
        }
        return Promise.resolve('备用模型回复');
      },
    );
    const result = await adapter.chat({
      systemPrompt: 'test',
      userMessage: '怎样拆解任务？',
      history: [],
    });
    expect(result.modelRoute).toBe('fallback');
    expect(result.degraded).toBe(true);
    expect(result.content).toContain('备用');
  });
});
