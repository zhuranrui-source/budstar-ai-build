import { HttpException, type HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'CAMPUS_CONTEXT_REQUIRED'
  | 'STUDENT_LOGIN_DISABLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL_ERROR';

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(
      { code, message, ...(details === undefined ? {} : { details }) },
      status,
    );
  }
}
