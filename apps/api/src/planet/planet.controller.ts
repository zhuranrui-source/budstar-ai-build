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
  adminCreatePlanetPostSchema,
  adminUpdatePlanetCommentSchema,
  adminUpdatePlanetPostSchema,
  createPlanetCommentSchema,
  memberCreatePlanetPostSchema,
  planetCategories,
  planetPostStatuses,
  type PlanetCategory,
  type PlanetPostStatus,
} from '@budstar/contracts';
import type { ZodType } from 'zod';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { Public } from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { PlanetMediaService } from './planet-media.service';
import { PlanetService } from './planet.service';

function parse<T>(schema: ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? '请求参数不合法',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

const asCategory = (value?: string): PlanetCategory | undefined =>
  (planetCategories as readonly string[]).includes(value ?? '')
    ? (value as PlanetCategory)
    : undefined;

const asStatus = (value?: string): PlanetPostStatus | undefined =>
  (planetPostStatuses as readonly string[]).includes(value ?? '')
    ? (value as PlanetPostStatus)
    : undefined;

function requireActor(
  request: AuthenticatedRequest,
  kinds: Array<'parent' | 'staff' | 'platform-admin'>,
): string {
  const actor = request.authorizationActor;
  if (!actor || !kinds.includes(actor.kind as (typeof kinds)[number])) {
    throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '无权执行该操作');
  }
  return actor.userAccountId;
}

/** 公开浏览：看帖不需要登录。 */
@Public()
@Controller('public/planet')
export class PublicPlanetController {
  constructor(private readonly planet: PlanetService) {}

  @Get('posts')
  list(@Query('category') category?: string, @Query('offset') offset?: string) {
    return this.planet.listPublished({
      category: asCategory(category),
      offset: Number(offset) || 0,
    });
  }

  @Get('posts/:id')
  get(@Param('id') id: string) {
    return this.planet.getPublished(id);
  }
}

/** 登录后互动：点赞、收藏、评论、发布自己孩子的作品。 */
@Controller('planet')
export class MemberPlanetController {
  constructor(
    private readonly planet: PlanetService,
    private readonly media: PlanetMediaService,
  ) {}

  @Post('images')
  upload(@Req() request: AuthenticatedRequest) {
    requireActor(request, ['parent', 'staff', 'platform-admin']);
    return this.media.save(request.body);
  }

  @Post('posts')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const accountId = requireActor(request, ['parent']);
    return this.planet.createMemberPost(
      accountId,
      parse(memberCreatePlanetPostSchema, body),
    );
  }

  @Get('mine')
  mine(@Req() request: AuthenticatedRequest) {
    return this.planet.listMine(requireActor(request, ['parent']));
  }

  @Post('posts/:id/remove')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.planet
      .removeOwnPost(requireActor(request, ['parent']), id)
      .then(() => ({ removed: true }));
  }

  @Post('posts/:id/like')
  like(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.planet.toggleLike(requireActor(request, ['parent']), id);
  }

  @Post('posts/:id/favorite')
  favorite(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.planet.toggleFavorite(requireActor(request, ['parent']), id);
  }

  @Post('posts/:id/comments')
  comment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.planet.comment(
      requireActor(request, ['parent']),
      id,
      parse(createPlanetCommentSchema, body).body,
    );
  }

  @Get('states')
  states(@Req() request: AuthenticatedRequest, @Query('ids') ids?: string) {
    return this.planet.viewerStates(
      requireActor(request, ['parent']),
      (ids ?? '').split(',').filter(Boolean),
    );
  }

  @Get('favorites')
  favorites(@Req() request: AuthenticatedRequest) {
    return this.planet.listFavorites(requireActor(request, ['parent']));
  }
}

/** 后台：员工与平台管理员发布内容、处理帖子与评论。 */
@Controller('admin/planet')
export class AdminPlanetController {
  constructor(private readonly planet: PlanetService) {}

  @Get('posts')
  list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('offset') offset?: string,
  ) {
    requireActor(request, ['staff', 'platform-admin']);
    return this.planet.adminListPosts(asStatus(status), Number(offset) || 0);
  }

  @Post('posts')
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.planet.createAdminPost(
      requireActor(request, ['staff', 'platform-admin']),
      parse(adminCreatePlanetPostSchema, body),
    );
  }

  @Patch('posts/:id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    requireActor(request, ['staff', 'platform-admin']);
    return this.planet.adminUpdatePost(
      id,
      parse(adminUpdatePlanetPostSchema, body),
    );
  }

  @Get('comments')
  comments(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    requireActor(request, ['staff', 'platform-admin']);
    return this.planet.adminListComments(asStatus(status));
  }

  @Patch('comments/:id')
  updateComment(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    requireActor(request, ['staff', 'platform-admin']);
    return this.planet.adminUpdateComment(
      id,
      parse(adminUpdatePlanetCommentSchema, body).status,
    );
  }
}
