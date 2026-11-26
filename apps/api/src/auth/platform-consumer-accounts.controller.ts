import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { consumerCredentialAssignSchema } from '@budstar/contracts';
import {
  AuditBusinessWrite,
  RequirePlatformCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { AuthenticationService } from './authentication.service';

/** 平台统一分配官网客户账号密码。 */
@Controller('platform/consumer-accounts')
@RequirePlatformCapability('PLATFORM_CRM_OPERATE')
export class PlatformConsumerAccountsController {
  constructor(private readonly authentication: AuthenticationService) {}

  @Get()
  list() {
    return this.authentication.listAssignedConsumerAccounts();
  }

  @Post()
  @AuditBusinessWrite('consumer-account')
  assign(@Body() body: unknown) {
    const parsed = consumerCredentialAssignSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请填写正确的手机号；账号 4-20 位字母/数字/下划线；密码 8-64 位且包含字母和数字',
      );
    }
    return this.authentication.assignConsumerCredentials(parsed.data);
  }
}
