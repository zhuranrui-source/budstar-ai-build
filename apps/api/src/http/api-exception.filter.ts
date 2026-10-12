import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorCode } from './api-error';

const codesByStatus: Partial<Record<number, ApiErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

const messagesByStatus: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: '请求参数不合法',
  [HttpStatus.UNAUTHORIZED]: '请先完成身份验证',
  [HttpStatus.FORBIDDEN]: '无权执行该操作',
  [HttpStatus.NOT_FOUND]: '请求的资源不存在',
  [HttpStatus.METHOD_NOT_ALLOWED]: '请求方法不受支持',
  [HttpStatus.CONFLICT]: '请求与现有资源冲突',
  [HttpStatus.PAYLOAD_TOO_LARGE]: '请求体过大',
  [HttpStatus.TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = this.getStatus(exception);
    const explicit =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    if (
      typeof explicit === 'object' &&
      explicit !== null &&
      'code' in explicit &&
      'message' in explicit
    ) {
      response.status(status).json(explicit);
      return;
    }

    response.status(status).json({
      code: codesByStatus[status] ?? 'INTERNAL_ERROR',
      message:
        messagesByStatus[status] ??
        (status >= 500 ? '服务暂时不可用' : '请求失败'),
    });
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (
      typeof exception === 'object' &&
      exception !== null &&
      'status' in exception &&
      (exception.status === HttpStatus.BAD_REQUEST ||
        exception.status === HttpStatus.PAYLOAD_TOO_LARGE)
    ) {
      return exception.status;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
