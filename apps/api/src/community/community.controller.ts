import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import {
  createCommunityPostSchema,
  reviewCommunityPostSchema,
} from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { CommunityService } from './community.service';

@Controller('admin/community')
@RequireCampusCapability('FAMILY_COMMUNICATE')
export class AdminCommunityController {
  constructor(private readonly community: CommunityService) {}

  @Post('posts')
  @AuditBusinessWrite('community-post')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = createCommunityPostSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.community.createPost(
      request.campusId!,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }

  @Get('moderation')
  listModeration(@Req() request: AuthenticatedRequest) {
    return this.community.listModeration(request.campusId!);
  }

  @Post('posts/:id/review')
  @AuditBusinessWrite('community-post')
  review(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = reviewCommunityPostSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.community.reviewPost(
      request.campusId!,
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }
}

@Controller('family/planet')
export class FamilyPlanetController {
  constructor(private readonly community: CommunityService) {}

  @Get('feed')
  feed(@Req() request: AuthenticatedRequest) {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'parent') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅家长可访问');
    }
    return this.community.listParentFeed(actor.activeStudentBindings);
  }
}

@Controller('student/planet')
export class StudentPlanetController {
  constructor(private readonly community: CommunityService) {}

  @Get('feed')
  feed(@Req() request: AuthenticatedRequest) {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'student') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅学生可访问');
    }
    return this.community.listStudentFeed(actor.studentProfileId);
  }
}
