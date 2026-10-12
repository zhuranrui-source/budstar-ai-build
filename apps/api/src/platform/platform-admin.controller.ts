import { Controller, Get, HttpStatus, Query, Req } from '@nestjs/common';
import { platformDataBrowseQuerySchema } from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { RequirePlatformCapability } from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { PlatformAdminService } from './platform-admin.service';

@Controller('platform')
@RequirePlatformCapability('PLATFORM_CAMPUS_GOVERN')
export class PlatformAdminController {
  constructor(private readonly platform: PlatformAdminService) {}

  @Get('data-browser')
  browse(
    @Req() request: AuthenticatedRequest,
    @Query('entity') entity?: string,
    @Query('campusId') campusId?: string,
    @Query('limit') limit?: string,
  ) {
    void request;
    const parsed = platformDataBrowseQuerySchema.safeParse({
      entity,
      ...(campusId ? { campusId } : {}),
      ...(limit ? { limit } : {}),
    });
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '仅支持白名单实体与字段筛选，禁止任意 SQL',
      );
    }
    return this.platform.browse(parsed.data);
  }
}
