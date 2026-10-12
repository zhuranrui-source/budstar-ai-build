import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import { aiTeacherChatRequestSchema } from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  Public,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { AiTeacherService } from './ai-teacher.service';

@Controller('ai-teacher')
export class AiTeacherController {
  constructor(private readonly aiTeacher: AiTeacherService) {}

  @Get('readiness')
  @Public()
  readiness() {
    return this.aiTeacher.readiness();
  }

  @Post('chat')
  @AuditBusinessWrite('ai-teacher')
  chat(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'student') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅学生可访问');
    }
    const parsed = aiTeacherChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
    return this.aiTeacher.chat(actor.studentProfileId, parsed.data);
  }
}
