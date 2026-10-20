import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createEnrollmentRecordSchema,
  listAppointmentLeadsQuerySchema,
  transitionAppointmentLeadSchema,
  updateAppointmentLeadSchema,
} from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequirePlatformCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { CrmLeadsService } from './crm-leads.service';

@Controller('admin/appointment-leads')
@RequirePlatformCapability('PLATFORM_CRM_OPERATE')
export class CrmLeadsController {
  constructor(private readonly crmLeads: CrmLeadsService) {}

  /**
   * ADR-0009：线索运营归平台管理员；平台身份须显式声明操作的校区上下文，
   * 服务端仍按该校区过滤，不做跨校区聚合导出。
   */
  private requiredCampusId(request: AuthenticatedRequest): string {
    const campusId = request.headers['x-campus-id'];
    const value = Array.isArray(campusId) ? campusId[0] : campusId;
    if (!value) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'CAMPUS_CONTEXT_REQUIRED',
        '缺少 X-Campus-Id 校区上下文',
      );
    }
    return value;
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: unknown) {
    const parsed = listAppointmentLeadsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.crmLeads.list(this.requiredCampusId(request), parsed.data);
  }

  @Get('funnel')
  funnel(
    @Req() request: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.crmLeads.funnel(this.requiredCampusId(request), {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('trend')
  trend(@Req() request: AuthenticatedRequest, @Query('days') days?: string) {
    const parsed = days ? Number(days) : 14;
    return this.crmLeads.trend(
      this.requiredCampusId(request),
      Number.isFinite(parsed) && parsed > 0 && parsed <= 90
        ? Math.floor(parsed)
        : 14,
    );
  }

  @Get(':id/phone')
  @AuditBusinessWrite('lead-phone-reveal')
  phone(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.crmLeads.getLeadPhone(this.requiredCampusId(request), id);
  }

  @Get(':id/history')
  history(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.crmLeads.getHistory(this.requiredCampusId(request), id);
  }

  @Patch(':id')
  @AuditBusinessWrite('appointment-lead')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateAppointmentLeadSchema.safeParse(body);
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
    return this.crmLeads.update(
      this.requiredCampusId(request),
      id,
      parsed.data,
    );
  }

  @Post(':id/transitions')
  @AuditBusinessWrite('appointment-lead')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = transitionAppointmentLeadSchema.safeParse(body);
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
    return this.crmLeads.transition(
      this.requiredCampusId(request),
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }

  @Post(':id/enrollment')
  @AuditBusinessWrite('enrollment-record')
  enroll(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = createEnrollmentRecordSchema.safeParse(body ?? {});
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
    return this.crmLeads.enroll(
      this.requiredCampusId(request),
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }
}
