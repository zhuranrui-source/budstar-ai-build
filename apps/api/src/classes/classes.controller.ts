import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { createClassSchema, updateClassSchema } from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { ClassesService } from './classes.service';

@Controller('admin/classes')
@RequireCampusCapability('CLASS_MANAGE')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.classes.list(request.campusId!);
  }

  @Post()
  @AuditBusinessWrite('class')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = createClassSchema.safeParse(body);
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
    return this.classes.create(request.campusId!, parsed.data);
  }

  @Patch(':id')
  @AuditBusinessWrite('class')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateClassSchema.safeParse(body);
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
    return this.classes.update(request.campusId!, id, parsed.data);
  }

  @Get(':id/students')
  listStudents(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.classes.listStudents(request.campusId!, id);
  }
}
