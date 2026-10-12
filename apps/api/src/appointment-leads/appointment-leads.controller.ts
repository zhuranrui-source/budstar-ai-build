import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  createAppointmentLeadSchema,
  type AppointmentLeadCreated,
} from '@budstar/contracts';
import { AppointmentLeadsService } from './appointment-leads.service';
import { ApiException } from '../http/api-error';
import { PublicAppointmentRateLimitGuard } from './public-appointment-rate-limit.guard';
import { Public } from '../authorization/authorization.decorators';

@Controller('public/appointment-leads')
@Public()
@UseGuards(PublicAppointmentRateLimitGuard)
export class AppointmentLeadsController {
  constructor(private readonly appointmentLeads: AppointmentLeadsService) {}

  @Post()
  async create(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AppointmentLeadCreated> {
    const parsed = createAppointmentLeadSchema.safeParse(body);

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

    if (
      idempotencyKey !== undefined &&
      !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)
    ) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
        [{ field: 'Idempotency-Key', message: '幂等键格式不合法' }],
      );
    }

    const result = await this.appointmentLeads.create(
      parsed.data,
      idempotencyKey,
    );
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.lead;
  }
}
