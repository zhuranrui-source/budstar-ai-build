import { randomUUID } from 'node:crypto';
import type { PlanetCategory, PlanetPostStatus } from '@budstar/contracts';

export const PLANET_STORE = Symbol('PLANET_STORE');

export type PlanetAuthorKind = 'STAFF' | 'PARENT';

export type PlanetPostRecord = {
  id: string;
  category: PlanetCategory;
  title: string;
  body: string;
  imageUrls: string[];
  studentInitial: string | null;
  guardianConsent: boolean;
  authorAccountId: string;
  authorKind: PlanetAuthorKind;
  status: PlanetPostStatus;
  reviewReason: string | null;
  pinned: boolean;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  createdAt: Date;
};

export type PlanetCommentRecord = {
  id: string;
  postId: string;
  authorAccountId: string;
  body: string;
  status: PlanetPostStatus;
  reviewReason: string | null;
  createdAt: Date;
};

export type NewPlanetPost = Omit<
  PlanetPostRecord,
  'id' | 'likeCount' | 'favoriteCount' | 'commentCount' | 'createdAt'
>;

export type NewPlanetComment = Omit<PlanetCommentRecord, 'id' | 'createdAt'>;

export type PlanetPostQuery = {
  statuses: PlanetPostStatus[];
  category?: PlanetCategory;
  authorAccountId?: string;
  offset: number;
  limit: number;
};

export interface PlanetStore {
  createPost(input: NewPlanetPost): Promise<PlanetPostRecord>;
  findPost(id: string): Promise<PlanetPostRecord | null>;
  /** 置顶优先，其余按发布时间倒序。 */
  listPosts(query: PlanetPostQuery): Promise<PlanetPostRecord[]>;
  updatePost(
    id: string,
    patch: Partial<
      Pick<PlanetPostRecord, 'status' | 'pinned' | 'reviewReason'>
    >,
  ): Promise<PlanetPostRecord | null>;
  toggleLike(postId: string, accountId: string): Promise<boolean>;
  toggleFavorite(postId: string, accountId: string): Promise<boolean>;
  viewerStates(
    accountId: string,
    postIds: string[],
  ): Promise<{ liked: Set<string>; favorited: Set<string> }>;
  listFavoritePosts(
    accountId: string,
    limit: number,
  ): Promise<PlanetPostRecord[]>;
  createComment(input: NewPlanetComment): Promise<PlanetCommentRecord>;
  findComment(id: string): Promise<PlanetCommentRecord | null>;
  listComments(query: {
    postId?: string;
    statuses: PlanetPostStatus[];
    limit: number;
  }): Promise<PlanetCommentRecord[]>;
  updateCommentStatus(
    id: string,
    status: PlanetPostStatus,
  ): Promise<PlanetCommentRecord | null>;
  countRecent(
    kind: 'post' | 'comment',
    accountId: string,
    since: Date,
  ): Promise<number>;
}

const sortPosts = (a: PlanetPostRecord, b: PlanetPostRecord) =>
  Number(b.pinned) - Number(a.pinned) ||
  b.createdAt.getTime() - a.createdAt.getTime();

export class InMemoryPlanetStore implements PlanetStore {
  private readonly posts = new Map<string, PlanetPostRecord>();
  private readonly comments = new Map<string, PlanetCommentRecord>();
  private readonly likes = new Map<string, Date>();
  private readonly favorites = new Map<string, Date>();
  private clock = 0;

  /** 保证同一毫秒内创建的记录仍有确定顺序。 */
  private now(): Date {
    this.clock = Math.max(this.clock + 1, Date.now());
    return new Date(this.clock);
  }

  createPost(input: NewPlanetPost): Promise<PlanetPostRecord> {
    const record: PlanetPostRecord = {
      ...input,
      id: randomUUID(),
      likeCount: 0,
      favoriteCount: 0,
      commentCount: 0,
      createdAt: this.now(),
    };
    this.posts.set(record.id, record);
    return Promise.resolve({ ...record });
  }

  findPost(id: string): Promise<PlanetPostRecord | null> {
    const record = this.posts.get(id);
    return Promise.resolve(record ? { ...record } : null);
  }

  listPosts(query: PlanetPostQuery): Promise<PlanetPostRecord[]> {
    return Promise.resolve(
      [...this.posts.values()]
        .filter((post) => query.statuses.includes(post.status))
        .filter((post) => !query.category || post.category === query.category)
        .filter(
          (post) =>
            !query.authorAccountId ||
            post.authorAccountId === query.authorAccountId,
        )
        .sort(sortPosts)
        .slice(query.offset, query.offset + query.limit)
        .map((post) => ({ ...post })),
    );
  }

  updatePost(
    id: string,
    patch: Partial<
      Pick<PlanetPostRecord, 'status' | 'pinned' | 'reviewReason'>
    >,
  ): Promise<PlanetPostRecord | null> {
    const record = this.posts.get(id);
    if (!record) return Promise.resolve(null);
    Object.assign(record, patch);
    return Promise.resolve({ ...record });
  }

  toggleLike(postId: string, accountId: string): Promise<boolean> {
    return Promise.resolve(
      this.toggle(this.likes, postId, accountId, 'likeCount'),
    );
  }

  toggleFavorite(postId: string, accountId: string): Promise<boolean> {
    return Promise.resolve(
      this.toggle(this.favorites, postId, accountId, 'favoriteCount'),
    );
  }

  private toggle(
    set: Map<string, Date>,
    postId: string,
    accountId: string,
    counter: 'likeCount' | 'favoriteCount',
  ): boolean {
    const key = `${postId}:${accountId}`;
    const active = !set.has(key);
    if (active) set.set(key, this.now());
    else set.delete(key);
    const post = this.posts.get(postId);
    if (post) {
      post[counter] = [...set.keys()].filter((k) =>
        k.startsWith(`${postId}:`),
      ).length;
    }
    return active;
  }

  viewerStates(
    accountId: string,
    postIds: string[],
  ): Promise<{ liked: Set<string>; favorited: Set<string> }> {
    const pick = (set: Map<string, Date>) =>
      new Set(postIds.filter((id) => set.has(`${id}:${accountId}`)));
    return Promise.resolve({
      liked: pick(this.likes),
      favorited: pick(this.favorites),
    });
  }

  listFavoritePosts(
    accountId: string,
    limit: number,
  ): Promise<PlanetPostRecord[]> {
    return Promise.resolve(
      [...this.favorites.entries()]
        .filter(([key]) => key.endsWith(`:${accountId}`))
        .sort((a, b) => b[1].getTime() - a[1].getTime())
        .map(([key]) => this.posts.get(key.split(':')[0]))
        .filter((post): post is PlanetPostRecord => Boolean(post))
        .filter((post) => post.status === 'PUBLISHED')
        .slice(0, limit)
        .map((post) => ({ ...post })),
    );
  }

  createComment(input: NewPlanetComment): Promise<PlanetCommentRecord> {
    const record: PlanetCommentRecord = {
      ...input,
      id: randomUUID(),
      createdAt: this.now(),
    };
    this.comments.set(record.id, record);
    this.recountComments(record.postId);
    return Promise.resolve({ ...record });
  }

  findComment(id: string): Promise<PlanetCommentRecord | null> {
    const record = this.comments.get(id);
    return Promise.resolve(record ? { ...record } : null);
  }

  listComments(query: {
    postId?: string;
    statuses: PlanetPostStatus[];
    limit: number;
  }): Promise<PlanetCommentRecord[]> {
    return Promise.resolve(
      [...this.comments.values()]
        .filter((comment) => !query.postId || comment.postId === query.postId)
        .filter((comment) => query.statuses.includes(comment.status))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, query.limit)
        .map((comment) => ({ ...comment })),
    );
  }

  updateCommentStatus(
    id: string,
    status: PlanetPostStatus,
  ): Promise<PlanetCommentRecord | null> {
    const record = this.comments.get(id);
    if (!record) return Promise.resolve(null);
    record.status = status;
    this.recountComments(record.postId);
    return Promise.resolve({ ...record });
  }

  private recountComments(postId: string): void {
    const post = this.posts.get(postId);
    if (!post) return;
    post.commentCount = [...this.comments.values()].filter(
      (comment) => comment.postId === postId && comment.status === 'PUBLISHED',
    ).length;
  }

  countRecent(
    kind: 'post' | 'comment',
    accountId: string,
    since: Date,
  ): Promise<number> {
    const source =
      kind === 'post' ? [...this.posts.values()] : [...this.comments.values()];
    return Promise.resolve(
      source.filter(
        (item) => item.authorAccountId === accountId && item.createdAt >= since,
      ).length,
    );
  }
}
