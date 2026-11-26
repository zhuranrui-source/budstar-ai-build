import type { PlanetPostStatus } from '@budstar/contracts';
import { PrismaService } from '../database/prisma.service';
import type {
  NewPlanetComment,
  NewPlanetPost,
  PlanetCommentRecord,
  PlanetPostQuery,
  PlanetPostRecord,
  PlanetStore,
} from './planet.store';

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export class PrismaPlanetStore implements PlanetStore {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async createPost(input: NewPlanetPost): Promise<PlanetPostRecord> {
    return this.db.planetPost.create({ data: input });
  }

  async findPost(id: string): Promise<PlanetPostRecord | null> {
    if (!isUuid(id)) return null;
    return this.db.planetPost.findUnique({ where: { id } });
  }

  async listPosts(query: PlanetPostQuery): Promise<PlanetPostRecord[]> {
    return this.db.planetPost.findMany({
      where: {
        status: { in: query.statuses },
        ...(query.category ? { category: query.category } : {}),
        ...(query.authorAccountId
          ? { authorAccountId: query.authorAccountId }
          : {}),
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      skip: query.offset,
      take: query.limit,
    });
  }

  async updatePost(
    id: string,
    patch: Partial<
      Pick<PlanetPostRecord, 'status' | 'pinned' | 'reviewReason'>
    >,
  ): Promise<PlanetPostRecord | null> {
    if (!(await this.findPost(id))) return null;
    return this.db.planetPost.update({ where: { id }, data: patch });
  }

  async toggleLike(postId: string, accountId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const removed = await tx.planetPostLike.deleteMany({
        where: { postId, accountId },
      });
      if (removed.count === 0) {
        await tx.planetPostLike.create({ data: { postId, accountId } });
      }
      const likeCount = await tx.planetPostLike.count({ where: { postId } });
      await tx.planetPost.update({
        where: { id: postId },
        data: { likeCount },
      });
      return removed.count === 0;
    });
  }

  async toggleFavorite(postId: string, accountId: string): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const removed = await tx.planetPostFavorite.deleteMany({
        where: { postId, accountId },
      });
      if (removed.count === 0) {
        await tx.planetPostFavorite.create({ data: { postId, accountId } });
      }
      const favoriteCount = await tx.planetPostFavorite.count({
        where: { postId },
      });
      await tx.planetPost.update({
        where: { id: postId },
        data: { favoriteCount },
      });
      return removed.count === 0;
    });
  }

  async viewerStates(
    accountId: string,
    postIds: string[],
  ): Promise<{ liked: Set<string>; favorited: Set<string> }> {
    const ids = postIds.filter(isUuid);
    const [likes, favorites] = await Promise.all([
      this.db.planetPostLike.findMany({
        where: { accountId, postId: { in: ids } },
        select: { postId: true },
      }),
      this.db.planetPostFavorite.findMany({
        where: { accountId, postId: { in: ids } },
        select: { postId: true },
      }),
    ]);
    return {
      liked: new Set(likes.map((row) => row.postId)),
      favorited: new Set(favorites.map((row) => row.postId)),
    };
  }

  async listFavoritePosts(
    accountId: string,
    limit: number,
  ): Promise<PlanetPostRecord[]> {
    const rows = await this.db.planetPostFavorite.findMany({
      where: { accountId, post: { status: 'PUBLISHED' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { post: true },
    });
    return rows.map((row) => row.post);
  }

  async createComment(input: NewPlanetComment): Promise<PlanetCommentRecord> {
    return this.db.$transaction(async (tx) => {
      const comment = await tx.planetComment.create({ data: input });
      await this.recount(tx, input.postId);
      return comment;
    });
  }

  async findComment(id: string): Promise<PlanetCommentRecord | null> {
    if (!isUuid(id)) return null;
    return this.db.planetComment.findUnique({ where: { id } });
  }

  async listComments(query: {
    postId?: string;
    statuses: PlanetPostStatus[];
    limit: number;
  }): Promise<PlanetCommentRecord[]> {
    return this.db.planetComment.findMany({
      where: {
        status: { in: query.statuses },
        ...(query.postId ? { postId: query.postId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
    });
  }

  async updateCommentStatus(
    id: string,
    status: PlanetPostStatus,
  ): Promise<PlanetCommentRecord | null> {
    if (!(await this.findComment(id))) return null;
    return this.db.$transaction(async (tx) => {
      const comment = await tx.planetComment.update({
        where: { id },
        data: { status },
      });
      await this.recount(tx, comment.postId);
      return comment;
    });
  }

  private async recount(
    tx: Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0],
    postId: string,
  ): Promise<void> {
    const commentCount = await tx.planetComment.count({
      where: { postId, status: 'PUBLISHED' },
    });
    await tx.planetPost.update({
      where: { id: postId },
      data: { commentCount },
    });
  }

  async countRecent(
    kind: 'post' | 'comment',
    accountId: string,
    since: Date,
  ): Promise<number> {
    const where = { authorAccountId: accountId, createdAt: { gte: since } };
    return kind === 'post'
      ? this.db.planetPost.count({ where })
      : this.db.planetComment.count({ where });
  }
}
