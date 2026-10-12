import { Injectable } from '@nestjs/common';
import {
  AI_TEACHER_MAX_HISTORY_MESSAGES,
  truncateAiTeacherMessage,
} from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  AiConversationRecord,
  AiMessageRecord,
  AiTeacherStore,
} from './ai-teacher.service';

@Injectable()
export class PrismaAiTeacherStore implements AiTeacherStore {
  constructor(private readonly prisma: PrismaService) {}

  async findConversation(id: string): Promise<AiConversationRecord | null> {
    const row = await this.prisma.client.aiConversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    return row ? this.mapConversation(row) : null;
  }

  async findLatestConversation(
    studentProfileId: string,
    mainLessonId: string,
  ): Promise<AiConversationRecord | null> {
    const row = await this.prisma.client.aiConversation.findFirst({
      where: { studentProfileId, mainLessonId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    return row ? this.mapConversation(row) : null;
  }

  async saveConversation(
    record: AiConversationRecord,
  ): Promise<AiConversationRecord> {
    const messages = record.messages
      .slice(-AI_TEACHER_MAX_HISTORY_MESSAGES)
      .map((message) => ({
        ...message,
        content: truncateAiTeacherMessage(message.content),
      }));

    await this.prisma.client.aiConversation.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        campusId: record.campusId,
        classId: record.classId,
        studentProfileId: record.studentProfileId,
        mainLessonId: record.mainLessonId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        messages: {
          create: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            refusedHomework: message.refusedHomework,
            modelRoute: message.modelRoute,
            createdAt: message.createdAt,
          })),
        },
      },
      update: {
        updatedAt: record.updatedAt,
        messages: {
          deleteMany: {},
          create: messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            refusedHomework: message.refusedHomework,
            modelRoute: message.modelRoute,
            createdAt: message.createdAt,
          })),
        },
      },
    });

    return (await this.findConversation(record.id))!;
  }

  private mapConversation(row: {
    id: string;
    campusId: string;
    classId: string;
    studentProfileId: string;
    mainLessonId: string;
    createdAt: Date;
    updatedAt: Date;
    messages: Array<{
      id: string;
      conversationId: string;
      role: string;
      content: string;
      refusedHomework: boolean;
      modelRoute: string;
      createdAt: Date;
    }>;
  }): AiConversationRecord {
    return {
      id: row.id,
      campusId: row.campusId,
      classId: row.classId,
      studentProfileId: row.studentProfileId,
      mainLessonId: row.mainLessonId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages: row.messages
        .filter(
          (
            message,
          ): message is typeof message & { role: 'user' | 'assistant' } =>
            message.role === 'user' || message.role === 'assistant',
        )
        .map((message): AiMessageRecord => ({
          id: message.id,
          conversationId: message.conversationId,
          role: message.role,
          content: message.content,
          refusedHomework: message.refusedHomework,
          modelRoute: message.modelRoute,
          createdAt: message.createdAt,
        })),
    };
  }
}
