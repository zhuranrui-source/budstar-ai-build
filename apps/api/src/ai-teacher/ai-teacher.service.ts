import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AI_TEACHER_HOMEWORK_REFUSAL,
  AI_TEACHER_MAX_HISTORY_MESSAGES,
  buildAiTeacherSystemPrompt,
  detectsHomeworkProxyRequest,
  truncateAiTeacherMessage,
  type AiGatewayReadiness,
  type AiTeacherChatRequest,
  type AiTeacherChatResponse,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import type { AiGatewayAdapter } from './ai-gateway.boundaries';
import type { SubmissionStore } from '../submissions/submissions.service';

export type AiMessageRecord = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  refusedHomework: boolean;
  modelRoute: string;
  createdAt: Date;
};

export type AiConversationRecord = {
  id: string;
  campusId: string;
  classId: string;
  studentProfileId: string;
  mainLessonId: string;
  createdAt: Date;
  updatedAt: Date;
  messages: AiMessageRecord[];
};

export interface AiTeacherStore {
  findConversation(id: string): Promise<AiConversationRecord | null>;
  findLatestConversation(
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<AiConversationRecord | null>;
  saveConversation(record: AiConversationRecord): Promise<AiConversationRecord>;
}

export class InMemoryAiTeacherStore implements AiTeacherStore {
  private readonly conversations = new Map<string, AiConversationRecord>();

  findConversation(id: string): Promise<AiConversationRecord | null> {
    const record = this.conversations.get(id);
    return Promise.resolve(record ? structuredClone(record) : null);
  }

  findLatestConversation(
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<AiConversationRecord | null> {
    const matches = [...this.conversations.values()]
      .filter(
        (item) =>
          item.studentProfileId === studentProfileId &&
          item.mainLessonId === mainLessonId,
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return Promise.resolve(matches[0] ? structuredClone(matches[0]) : null);
  }

  saveConversation(
    record: AiConversationRecord,
  ): Promise<AiConversationRecord> {
    const minimized: AiConversationRecord = {
      ...structuredClone(record),
      messages: record.messages
        .slice(-AI_TEACHER_MAX_HISTORY_MESSAGES)
        .map((message) => ({
          ...message,
          content: truncateAiTeacherMessage(message.content),
        })),
    };
    this.conversations.set(minimized.id, minimized);
    return Promise.resolve(structuredClone(minimized));
  }
}

@Injectable()
export class AiTeacherService {
  constructor(
    private readonly gateway: AiGatewayAdapter,
    private readonly conversations: AiTeacherStore,
    private readonly submissions: SubmissionStore,
  ) {}

  readiness(): AiGatewayReadiness {
    return this.gateway.readiness();
  }

  async chat(
    studentProfileId: string,
    input: AiTeacherChatRequest,
  ): Promise<AiTeacherChatResponse> {
    const readiness = this.gateway.readiness();
    if (!readiness.ready) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        '星芽 AI 老师暂不可用',
        readiness.degradedReasons.map((reason) => ({ reason })),
      );
    }

    const membership = await this.submissions.findMembership(
      input.classId,
      studentProfileId,
    );
    if (!membership) {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '未加入该班级');
    }
    const classRef = await this.submissions.findClass(input.classId);
    if (!classRef) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '班级不存在');
    }
    const lesson = await this.submissions.findLesson(input.mainLessonId);
    if (!lesson || !lesson.assignment) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '课节或作业模板不存在',
      );
    }

    const systemPrompt = buildAiTeacherSystemPrompt({
      courseTitle: classRef.coursePackageTitle,
      lessonTitle: lesson.title,
      lessonTheme: lesson.theme,
      assignmentTitle: lesson.assignment.title,
      assignmentRequirements: lesson.assignment.requirements,
      track: lesson.track,
    });

    let conversation =
      (input.conversationId
        ? await this.conversations.findConversation(input.conversationId)
        : null) ??
      (await this.conversations.findLatestConversation(
        studentProfileId,
        input.mainLessonId,
      ));

    if (
      conversation &&
      (conversation.studentProfileId !== studentProfileId ||
        conversation.mainLessonId !== input.mainLessonId ||
        conversation.classId !== input.classId)
    ) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '无权访问该对话',
      );
    }

    const now = new Date();
    if (!conversation) {
      conversation = {
        id: randomUUID(),
        campusId: classRef.campusId,
        classId: input.classId,
        studentProfileId,
        mainLessonId: input.mainLessonId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
    }

    const userContent = truncateAiTeacherMessage(input.message);
    const refused = detectsHomeworkProxyRequest(userContent);
    conversation.messages.push({
      id: randomUUID(),
      conversationId: conversation.id,
      role: 'user',
      content: userContent,
      refusedHomework: refused,
      modelRoute: 'user',
      createdAt: now,
    });

    let result;
    try {
      result = refused
        ? {
            content: truncateAiTeacherMessage(AI_TEACHER_HOMEWORK_REFUSAL),
            modelRoute: 'mock' as const,
            degraded: false,
          }
        : await this.gateway.chat({
            systemPrompt,
            userMessage: userContent,
            history: conversation.messages
              .filter(
                (item) => item.role === 'user' || item.role === 'assistant',
              )
              .slice(-AI_TEACHER_MAX_HISTORY_MESSAGES)
              .map((item) => ({
                role: item.role,
                content: item.content,
              })),
          });
    } catch {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        '星芽 AI 老师暂时无法回答，请稍后重试',
      );
    }

    const assistantMessage: AiMessageRecord = {
      id: randomUUID(),
      conversationId: conversation.id,
      role: 'assistant',
      content: truncateAiTeacherMessage(result.content),
      refusedHomework: refused,
      modelRoute: result.modelRoute,
      createdAt: new Date(),
    };
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = assistantMessage.createdAt;
    await this.conversations.saveConversation(conversation);

    return {
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      role: 'assistant',
      content: assistantMessage.content,
      refusedHomework: refused,
      modelRoute: result.modelRoute,
      degraded: result.degraded,
      createdAt: assistantMessage.createdAt.toISOString(),
    };
  }
}
