'use client';

import { useEffect, useMemo, useState } from 'react';
import { activeAccessToken, resolveActiveRole } from '../auth-session';
import { CommunityShell } from '../community-shell';
import {
  DEMO_PLANET_WATERFALL,
  type PlanetChannel,
} from '../portal-demo-content';

type FeedItem = {
  id: string;
  title: string;
  body: string;
  studentDisplayName: string;
  visibilityScope: string;
  status: string;
  publishedAt: string | null;
};

type WaterfallCard = {
  id: string;
  channel: PlanetChannel;
  author: string;
  avatar: string;
  title: string;
  body: string;
  image?: string;
  imageAlt?: string;
  likes: number;
  comments: number;
  commentTags: string[];
  publishedAt: number;
  ratio: 'tall' | 'wide' | 'square';
};

type PlanetTab = 'all' | PlanetChannel;
type PlanetSort = 'newest' | 'hottest';

const PLANET_TABS: Array<{ id: PlanetTab; label: string; hint: string }> = [
  { id: 'all', label: '全部', hint: '看看大家最近在创作什么。' },
  {
    id: 'classroom',
    label: '课堂分享',
    hint: '老师课件与分享：含 AIGC 创作、Vibe Coding 等课堂内容。',
  },
  {
    id: 'works',
    label: '作业作品',
    hint: '看看同学们最近提交的作品与拓展创作。',
  },
];

const SORT_OPTIONS: Array<{ id: PlanetSort; label: string }> = [
  { id: 'newest', label: '最新' },
  { id: 'hottest', label: '最热' },
];

const COMMENT_TAG_POOL = [
  '观察很细',
  '标题清楚',
  '想学同款',
  '构图舒服',
  '说明到位',
  '下一版可对比',
  '老师已评',
  '有拓展',
  '互动不错',
  '主张明确',
] as const;

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

function seedFromId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function enrichCard(base: {
  id: string;
  channel: PlanetChannel;
  author: string;
  avatar: string;
  title: string;
  body: string;
  image?: string;
  imageAlt?: string;
  likes: number;
  ratio: 'tall' | 'wide' | 'square';
}): WaterfallCard {
  const seed = seedFromId(base.id);
  const tagA = COMMENT_TAG_POOL[seed % COMMENT_TAG_POOL.length];
  const tagB = COMMENT_TAG_POOL[(seed >> 3) % COMMENT_TAG_POOL.length];
  const tags = tagA === tagB ? [tagA] : [tagA, tagB];
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    ...base,
    comments: 2 + (seed % 9),
    commentTags: tags,
    publishedAt:
      Date.now() - (seed % 18) * dayMs - (seed % 12) * 60 * 60 * 1000,
  };
}

function toWaterfallCard(item: FeedItem): WaterfallCard {
  return enrichCard({
    id: item.id,
    channel: 'works',
    author: item.studentDisplayName || '学员',
    avatar: (item.studentDisplayName || '学').slice(0, 1),
    title: item.title,
    body: item.body,
    likes: 0,
    ratio: 'square',
  });
}

function heatScore(card: WaterfallCard, liked: boolean): number {
  const likes = card.likes + (liked ? 1 : 0);
  return likes * 3 + card.comments * 2;
}

export default function PlanetFeedPage() {
  const [role, setRole] = useState<'parent' | 'student' | null>(null);
  const [tab, setTab] = useState<PlanetTab>('all');
  const [sort, setSort] = useState<PlanetSort>('newest');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeBonus, setLikeBonus] = useState<Record<string, number>>({});
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');
  const [extraTags, setExtraTags] = useState<Record<string, string[]>>({});
  const [commentBonus, setCommentBonus] = useState<Record<string, number>>({});

  useEffect(() => {
    void (async () => {
      await Promise.resolve();
      setRole(resolveActiveRole());
    })();
  }, []);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    void (async () => {
      const token = activeAccessToken(role) ?? '';
      if (!token) {
        setError('请先登录后查看星芽星球');
        setItems([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const path =
          role === 'parent' ? '/family/planet/feed' : '/student/planet/feed';
        const response = await fetch(`${apiBaseUrl}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error(`PLANET_${response.status}`);
        }
        const next = (await response.json()) as FeedItem[];
        if (!cancelled) setItems(next);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : '加载失败');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const cards = useMemo(() => {
    const fromApi = items.map(toWaterfallCard);
    const all = [
      ...DEMO_PLANET_WATERFALL.map((item) =>
        enrichCard({
          id: item.id,
          channel: item.channel,
          author: item.author,
          avatar: item.avatar,
          title: item.title,
          body: item.body,
          image: item.image,
          imageAlt: item.imageAlt,
          likes: item.likes,
          ratio: item.ratio,
        }),
      ),
      ...fromApi,
    ].map((card) => ({
      ...card,
      likes: card.likes + (likeBonus[card.id] ?? 0),
      comments: card.comments + (commentBonus[card.id] ?? 0),
      commentTags: [...card.commentTags, ...(extraTags[card.id] ?? [])].slice(
        0,
        3,
      ),
    }));

    const filtered =
      tab === 'all' ? all : all.filter((card) => card.channel === tab);

    const sorted = [...filtered].sort((left, right) => {
      if (sort === 'hottest') {
        return (
          heatScore(right, Boolean(likedMap[right.id])) -
          heatScore(left, Boolean(likedMap[left.id]))
        );
      }
      return right.publishedAt - left.publishedAt;
    });
    return sorted;
  }, [commentBonus, extraTags, items, likeBonus, likedMap, sort, tab]);

  const columnClass =
    cards.length >= 12
      ? 'is-cols-4'
      : cards.length >= 8
        ? 'is-cols-3'
        : cards.length >= 4
          ? 'is-cols-3'
          : 'is-cols-2';

  const activeHint =
    PLANET_TABS.find((item) => item.id === tab)?.hint ??
    '看看大家最近在创作什么。';

  function toggleLike(cardId: string) {
    const nextLiked = !likedMap[cardId];
    setLikedMap((current) => ({ ...current, [cardId]: nextLiked }));
    setLikeBonus((bonus) => ({
      ...bonus,
      [cardId]: (bonus[cardId] ?? 0) + (nextLiked ? 1 : -1),
    }));
  }

  function submitComment(cardId: string) {
    const tag = draftComment.trim().slice(0, 12);
    if (!tag) return;
    setExtraTags((current) => ({
      ...current,
      [cardId]: [...(current[cardId] ?? []), tag].slice(0, 3),
    }));
    setCommentBonus((current) => ({
      ...current,
      [cardId]: (current[cardId] ?? 0) + 1,
    }));
    setDraftComment('');
    setCommentOpenId(null);
  }

  return (
    <CommunityShell active="planet" subtitle="">
      <section
        className="community-panel is-active planet-waterfall-page"
        data-student-panel="planet"
      >
        <div className="planet-waterfall-head">
          <h1>星球动态</h1>
          <p>{activeHint}</p>
          <div className="planet-toolbar">
            <div
              className="planet-channel-tabs"
              role="tablist"
              aria-label="星球栏目"
            >
              {PLANET_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'is-active' : undefined}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className="planet-sort-tabs"
              role="group"
              aria-label="排序方式"
            >
              {SORT_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={sort === item.id ? 'is-active' : undefined}
                  onClick={() => setSort(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && <p className="planet-waterfall-status">加载中…</p>}
        {error && (
          <p className="planet-waterfall-status" role="status">
            接口暂不可用，先展示班级动态。
          </p>
        )}

        {cards.length === 0 ? (
          <div className="community-empty">
            <b>这个栏目还没有内容</b>
            <p>换个栏目看看，或等老师 / 同学发布新动态。</p>
          </div>
        ) : (
          <div
            className={`planet-waterfall ${columnClass}`}
            aria-label={`${PLANET_TABS.find((item) => item.id === tab)?.label ?? '星球'}瀑布流`}
          >
            {cards.map((card) => {
              const liked = Boolean(likedMap[card.id]);
              return (
                <article
                  key={card.id}
                  className={`planet-waterfall-card is-${card.ratio}`}
                >
                  {card.image ? (
                    <div className="planet-waterfall-media">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={card.image} alt={card.imageAlt ?? card.title} />
                      <span className="planet-channel-tag">
                        {card.channel === 'classroom' ? '课堂' : '作品'}
                      </span>
                    </div>
                  ) : null}
                  <div className="planet-waterfall-copy">
                    <h2>{card.title}</h2>
                    <p>{card.body}</p>
                    {card.commentTags.length > 0 && (
                      <div
                        className="planet-comment-tags"
                        aria-label="热门评论标签"
                      >
                        {card.commentTags.map((tag) => (
                          <span key={`${card.id}-${tag}`}>{tag}</span>
                        ))}
                      </div>
                    )}
                    <footer>
                      <span className="community-avatar is-child">
                        {card.avatar}
                      </span>
                      <b>{card.author}</b>
                      <button
                        type="button"
                        className={
                          liked ? 'planet-action is-liked' : 'planet-action'
                        }
                        aria-pressed={liked}
                        aria-label={liked ? '取消点赞' : '点赞'}
                        onClick={() => toggleLike(card.id)}
                      >
                        {liked ? '♥' : '♡'} {card.likes}
                      </button>
                      <button
                        type="button"
                        className="planet-action"
                        aria-expanded={commentOpenId === card.id}
                        aria-label="评论"
                        onClick={() =>
                          setCommentOpenId((current) =>
                            current === card.id ? null : card.id,
                          )
                        }
                      >
                        💬 {card.comments}
                      </button>
                    </footer>
                    {commentOpenId === card.id && (
                      <form
                        className="planet-comment-box"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitComment(card.id);
                        }}
                      >
                        <input
                          value={draftComment}
                          maxLength={12}
                          placeholder="写一句短评标签，如「观察很细」"
                          onChange={(event) =>
                            setDraftComment(event.target.value)
                          }
                        />
                        <button type="submit">发送</button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </CommunityShell>
  );
}
