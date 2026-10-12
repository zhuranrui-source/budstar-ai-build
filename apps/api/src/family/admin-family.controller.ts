import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { createStudentProfileSchema } from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { FamilyService } from './family.service';

@Controller('admin')
@RequireCampusCapability('FAMILY_COMMUNICATE')
export class AdminFamilyController {
  constructor(private readonly family: FamilyService) {}

  @Get('students')
  listStudents(@Req() request: AuthenticatedRequest) {
    return this.family.listStudents(request.campusId!);
  }

  @Post('students')
  @AuditBusinessWrite('student-profile')
  createStudent(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = createStudentProfileSchema.safeParse(body);
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
    return this.family.createStudent(request.campusId!, parsed.data);
  }

  @Post('students/:studentProfileId/family-view-code/reset')
  @AuditBusinessWrite('family-view-code')
  resetViewCode(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
  ) {
    return this.family.resetFamilyViewCode(request.campusId!, studentProfileId);
  }

  @Get('family-bindings')
  listBindings(@Req() request: AuthenticatedRequest) {
    return this.family.listCampusBindings(request.campusId!);
  }

  @Post('family-bindings/:bindingId/revoke')
  @AuditBusinessWrite('guardian-binding')
  revokeBinding(
    @Req() request: AuthenticatedRequest,
    @Param('bindingId') bindingId: string,
  ) {
    return this.family.revokeBindingAsStaff(request.campusId!, bindingId);
  }

  @Get('students/:studentProfileId/work-display')
  workDisplay(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
  ) {
    return this.family.getWorkDisplayEligibility(studentProfileId);
  }
}
