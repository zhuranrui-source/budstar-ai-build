import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { AuditBusinessWrite } from '../authorization/authorization.decorators';
import { AI_GATEWAY_ADAPTER } from '../ai-teacher/ai-gateway.tokens';
import type { AiGatewayAdapter } from '../ai-teacher/ai-gateway.boundaries';
import { ApiException } from '../http/api-error';
import { SubjectCoursesService } from './subject-courses.service';

function parseExplainRequest(body: unknown): { question: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const question = (body as { question?: unknown }).question;
  if (typeof question !== 'string') return null;
  const trimmed = question.trim();
  if (trimmed.length < 1 || trimmed.length > 500) return null;
  return { question: trimmed };
}

/**
 * 家庭视图的学科内容读取面（ADR-0007）：
 * 家长（含学生在侧共学）可浏览已发布的学科实验室目录与章节，
 * 并基于实验室「教师参考」上下文获得 AI 个性化讲解（ADR-0004 精神：
 * AI 输出为学习引导，不构成正式点评）。
 */
@Controller('family/subject-courses')
export class FamilySubjectCoursesController {
  constructor(
    private readonly subjectCourses: SubjectCoursesService,
    @Inject(AI_GATEWAY_ADAPTER)
    private readonly gateway: AiGatewayAdapter,
  ) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('subject') subject?: string,
    @Query('gradeBand') gradeBand?: string,
  ) {
    this.requireParent(request);
    return this.subjectCourses.listPublished({ subject, gradeBand });
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.requireParent(request);
    return this.subjectCourses.getPublished(id);
  }

  @Post(':courseId/chapters/:chapterId/explain')
  @AuditBusinessWrite('subject-course-ai-explain')
  async explain(
    @Req() request: AuthenticatedRequest,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: unknown,
  ) {
    this.requireParent(request);
    const parsed = parseExplainRequest(body);
    if (!parsed) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    const readiness = this.gateway.readiness();
    if (!readiness.ready) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        '星芽 AI 老师暂不可用',
      );
    }
    const course = await this.subjectCourses.getPublished(courseId);
    const chapter = course.chapters.find((item) => item.id === chapterId);
    if (!chapter) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '章节不存在');
    }

    const systemPrompt = [
      '你是 BudStar 星芽 AI 老师，正协助家长与孩子进行学科共学。',
      `当前章节：《${course.title}》第 ${chapter.sequence} 讲 ${chapter.title}。`,
      '以下是该互动实验室的「教师参考」备课内容，请以此为依据，',
      '用适龄、鼓励、不代做的口吻回答家长或学生的问题：',
      '优先解释概念与常见错因，引导孩子自己完成探究。',
      chapter.aiContext
        ? `【教师参考】\n${chapter.aiContext.slice(0, 12_000)}`
        : '（本章节暂无教师参考，按通用学科知识回答）',
    ].join('\n');

    const result = await this.gateway.chat({
      systemPrompt,
      userMessage: parsed.question,
      history: [],
    });
    return { answer: result.content, modelRoute: result.modelRoute };
  }

  private requireParent(request: AuthenticatedRequest): void {
    if (request.authorizationActor?.kind !== 'parent') {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '仅家长身份可访问家庭学科内容',
      );
    }
  }
}
