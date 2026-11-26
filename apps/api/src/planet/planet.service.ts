import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AdminCreatePlanetPostInput,
  AdminPlanetCommentView,
  AdminPlanetPostView,
  MemberCreatePlanetPostInput,
  PlanetCategory,
  PlanetCommentView,
  PlanetPostDetailView,
  PlanetPostStatus,
  PlanetPostView,
  PlanetViewerState,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import { reviewReasonFor } from './content-filter';
import { PlanetMediaService } from './planet-media.service';
import {
  PLANET_STORE,
  type PlanetAuthorKind,
  type PlanetCommentRecord,
  type PlanetPostRecord,
  type PlanetStore,
} from './planet.store';

export const PLANET_LIMITS = {
  pageSize: 20,
  postsPerDay: 10,
  commentsPerHour: 30,
  commentsPerPost: 100,
};

const notFound = () =>
  new ApiException(HttpStatus.NOT_FOUND, 'NOT_FOUND', '内容不存在或已下架');

const tooMany = (message: string) =>
  new ApiException(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', message);

/** 评论者只显示“家长·xxxx”，不暴露任何身份信息。 */
function memberLabel(accountId: string): string {
  return `家长·${accountId.replace(/-/g, '').slice(-4)}`;
}

@Injectable()
export class PlanetService {
  constructor(
    @Inject(PLANET_STORE) private readonly store: PlanetStore,
    private readonly media: PlanetMediaService,
  ) {}

  // ===== 公开浏览（无需登录） =====

  async listPublished(query: {
    category?: PlanetCategory;
    offset?: number;
  }): Promise<PlanetPostView[]> {
    const posts = await this.store.listPosts({
      statuses: ['PUBLISHED'],
      category: query.category,
      offset: Math.max(0, query.offset ?? 0),
      limit: PLANET_LIMITS.pageSize,
    });
    return posts.map((post) => this.toView(post));
  }

  async getPublished(id: string): Promise<PlanetPostDetailView> {
    const post = await this.store.findPost(id);
    if (!post || post.status !== 'PUBLISHED') throw notFound();
    const comments = await this.store.listComments({
      postId: id,
      statuses: ['PUBLISHED'],
      limit: PLANET_LIMITS.commentsPerPost,
    });
    return {
      ...this.toView(post),
      comments: comments.map((comment) => this.toCommentView(comment)),
    };
  }

  // ===== 登录用户（家长）互动 =====

  async createMemberPost(
    accountId: string,
    input: MemberCreatePlanetPostInput,
  ): Promise<AdminPlanetPostView> {
    const since = new Date(Date.now() - 24 * 3600_000);
    if (
      (await this.store.countRecent('post', accountId, since)) >=
      PLANET_LIMITS.postsPerDay
    ) {
      throw tooMany('今天发布次数已达上限，明天再来分享吧');
    }
    return this.createPost(accountId, 'PARENT', { ...input, pinned: false });
  }

  async listMine(accountId: string): Promise<AdminPlanetPostView[]> {
    const posts = await this.store.listPosts({
      statuses: ['PUBLISHED', 'PENDING_REVIEW'],
      authorAccountId: accountId,
      offset: 0,
      limit: 100,
    });
    return posts.map((post) => this.toAdminView(post));
  }

  async removeOwnPost(accountId: string, postId: string): Promise<void> {
    const post = await this.store.findPost(postId);
    if (!post || post.authorAccountId !== accountId) throw notFound();
    await this.store.updatePost(postId, { status: 'REMOVED' });
  }

  async toggleLike(accountId: string, postId: string) {
    await this.requirePublished(postId);
    const liked = await this.store.toggleLike(postId, accountId);
    const post = await this.store.findPost(postId);
    return { liked, likeCount: post?.likeCount ?? 0 };
  }

  async toggleFavorite(accountId: string, postId: string) {
    await this.requirePublished(postId);
    const favorited = await this.store.toggleFavorite(postId, accountId);
    const post = await this.store.findPost(postId);
    return { favorited, favoriteCount: post?.favoriteCount ?? 0 };
  }

  async viewerStates(
    accountId: string,
    postIds: string[],
  ): Promise<PlanetViewerState[]> {
    const ids = [...new Set(postIds)].slice(0, 50);
    const { liked, favorited } = await this.store.viewerStates(accountId, ids);
    return ids.map((postId) => ({
      postId,
      liked: liked.has(postId),
      favorited: favorited.has(postId),
    }));
  }

  async listFavorites(accountId: string): Promise<PlanetPostView[]> {
    const posts = await this.store.listFavoritePosts(accountId, 100);
    return posts.map((post) => this.toView(post));
  }

  /** 先发后审：发出即显示；命中敏感词或联系方式时转入待处理。 */
  async comment(
    accountId: string,
    postId: string,
    body: string,
  ): Promise<{ comment: PlanetCommentView; status: PlanetPostStatus }> {
    await this.requirePublished(postId);
    const since = new Date(Date.now() - 3600_000);
    if (
      (await this.store.countRecent('comment', accountId, since)) >=
      PLANET_LIMITS.commentsPerHour
    ) {
      throw tooMany('评论太频繁了，稍后再试');
    }
    const reviewReason = reviewReasonFor(body);
    const comment = await this.store.createComment({
      postId,
      authorAccountId: accountId,
      body,
      status: reviewReason ? 'PENDING_REVIEW' : 'PUBLISHED',
      reviewReason,
    });
    return { comment: this.toCommentView(comment), status: comment.status };
  }

  // ===== 后台（员工 / 平台管理员） =====

  async createAdminPost(
    accountId: string,
    input: AdminCreatePlanetPostInput,
  ): Promise<AdminPlanetPostView> {
    return this.createPost(accountId, 'STAFF', input);
  }

  async adminListPosts(status?: PlanetPostStatus, offset = 0) {
    const posts = await this.store.listPosts({
      statuses: status ? [status] : ['PUBLISHED', 'PENDING_REVIEW', 'REMOVED'],
      offset: Math.max(0, offset),
      limit: 50,
    });
    return posts.map((post) => this.toAdminView(post));
  }

  async adminUpdatePost(
    id: string,
    patch: { status?: PlanetPostStatus; pinned?: boolean },
  ): Promise<AdminPlanetPostView> {
    const updated = await this.store.updatePost(id, {
      ...patch,
      ...(patch.status === 'PUBLISHED' ? { reviewReason: null } : {}),
    });
    if (!updated) throw notFound();
    return this.toAdminView(updated);
  }

  async adminListComments(
    status?: PlanetPostStatus,
  ): Promise<AdminPlanetCommentView[]> {
    const comments = await this.store.listComments({
      statuses: status ? [status] : ['PUBLISHED', 'PENDING_REVIEW', 'REMOVED'],
      limit: 200,
    });
    const titles = new Map<string, string>();
    for (const comment of comments) {
      if (!titles.has(comment.postId)) {
        titles.set(
          comment.postId,
          (await this.store.findPost(comment.postId))?.title ?? '（已删除）',
        );
      }
    }
    return comments.map((comment) => ({
      ...this.toCommentView(comment),
      postId: comment.postId,
      postTitle: titles.get(comment.postId) ?? '',
      status: comment.status,
      reviewReason: comment.reviewReason,
    }));
  }

  async adminUpdateComment(id: string, status: PlanetPostStatus) {
    const updated = await this.store.updateCommentStatus(id, status);
    if (!updated) throw notFound();
    return { id: updated.id, status: updated.status };
  }

  // ===== 内部 =====

  private async createPost(
    accountId: string,
    authorKind: PlanetAuthorKind,
    input: AdminCreatePlanetPostInput,
  ): Promise<AdminPlanetPostView> {
    for (const url of input.imageUrls) {
      if (!(await this.media.exists(url))) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          'VALIDATION_ERROR',
          '图片不存在，请重新上传',
        );
      }
    }
    const reviewReason =
      authorKind === 'PARENT' ? reviewReasonFor(input.title, input.body) : null;
    const post = await this.store.createPost({
      category: input.category,
      title: input.title,
      body: input.body,
      imageUrls: input.imageUrls,
      studentInitial: input.studentInitial ?? null,
      guardianConsent: input.guardianConsent,
      authorAccountId: accountId,
      authorKind,
      status: reviewReason ? 'PENDING_REVIEW' : 'PUBLISHED',
      reviewReason,
      pinned: input.pinned,
    });
    return this.toAdminView(post);
  }

  private async requirePublished(postId: string): Promise<void> {
    const post = await this.store.findPost(postId);
    if (!post || post.status !== 'PUBLISHED') throw notFound();
  }

  private toView(post: PlanetPostRecord): PlanetPostView {
    return {
      id: post.id,
      category: post.category,
      title: post.title,
      body: post.body,
      imageUrls: post.imageUrls,
      studentLabel: post.studentInitial ? `小${post.studentInitial}` : null,
      authorLabel:
        post.authorKind === 'STAFF'
          ? '星芽老师'
          : memberLabel(post.authorAccountId),
      pinned: post.pinned,
      likeCount: post.likeCount,
      favoriteCount: post.favoriteCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt.toISOString(),
    };
  }

  private toAdminView(post: PlanetPostRecord): AdminPlanetPostView {
    return {
      ...this.toView(post),
      status: post.status,
      authorKind: post.authorKind,
      reviewReason: post.reviewReason,
    };
  }

  private toCommentView(comment: PlanetCommentRecord): PlanetCommentView {
    return {
      id: comment.id,
      body: comment.body,
      authorLabel: memberLabel(comment.authorAccountId),
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
