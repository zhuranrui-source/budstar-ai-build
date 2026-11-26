'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type {
  PlanetCategory,
  PlanetPostDetailView,
  PlanetPostView,
} from '@budstar/contracts';
import { activeAccessToken } from '../auth-session';
import { CommunityShell, type CommunityTab } from '../community-shell';
import { requestConsumerAuth } from '../consumer-auth';
import { compressImage } from './image-compress';
import {
  CATEGORY_LABEL,
  CATEGORY_TABS,
  MEDIA_ORIGIN,
  PlanetApiError,
  planetApi,
  timeAgo,
} from './planet-api';

type View = 'feed' | 'favorites' | 'mine';
type Post = PlanetPostView & { status?: string };
type Viewer = Record<string, { liked: boolean; favorited: boolean }>;

const media = (url: string) => `${MEDIA_ORIGIN}${url}`;

function shareUrl(id: string): string {
  return `${window.location.origin}/planet/p/${encodeURIComponent(id)}`;
}

/** 手机上调起系统分享面板；电脑上复制链接。 */
async function sharePost(
  post: { id: string; title: string; studentLabel: string | null },
  toast: (message: string) => void,
) {
  const url = shareUrl(post.id);
  const text = `${post.studentLabel ? `${post.studentLabel}的` : ''}${post.title}｜星芽星球`;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: text, text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('链接已复制，可以粘贴到微信发给好友');
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') return;
    window.prompt('复制下面的链接分享给好友：', url);
  }
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 15V4m0 0-4 4m4-4 4 4M5 13v6h14v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function askLogin(notice = '登录后即可点赞、收藏和评论') {
  requestConsumerAuth({ notice });
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-9.2-9A5.2 5.2 0 0 1 12 5.6 5.2 5.2 0 0 1 21.2 11C19 15.6 12 20 12 20Z"
        fill={filled ? '#e5484d' : 'none'}
        stroke={filled ? '#e5484d' : 'currentColor'}
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z"
        fill={filled ? '#f5a524' : 'none'}
        stroke={filled ? '#f5a524' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M4 5h16v11H9l-5 4V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlanetFeedPage({
  initialPostId,
}: {
  initialPostId?: string;
} = {}) {
  const [view, setView] = useState<View>('feed');
  const [category, setCategory] = useState<PlanetCategory | 'ALL'>('ALL');
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewer, setViewer] = useState<Viewer>({});
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(initialPostId ?? null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  }, []);

  useEffect(() => {
    const sync = () => setLoggedIn(Boolean(activeAccessToken()));
    const readView = () => {
      const value = new URLSearchParams(window.location.search).get('view');
      setView(value === 'favorites' || value === 'mine' ? value : 'feed');
    };
    void (async () => {
      await Promise.resolve();
      sync();
      readView();
    })();
    window.addEventListener('budstar:consumer-session-changed', sync);
    window.addEventListener('popstate', readView);
    return () => {
      window.removeEventListener('budstar:consumer-session-changed', sync);
      window.removeEventListener('popstate', readView);
    };
  }, []);

  const loadViewer = useCallback(async (items: Post[]) => {
    if (!activeAccessToken() || items.length === 0) return;
    try {
      const states = await planetApi.states(items.map((post) => post.id));
      setViewer((current) => {
        const next = { ...current };
        for (const state of states) next[state.postId] = state;
        return next;
      });
    } catch {
      // 互动状态加载失败不影响浏览
    }
  }, []);

  const load = useCallback(
    async (append = false) => {
      setLoading(true);
      setError('');
      try {
        if (view !== 'feed' && !activeAccessToken()) {
          setPosts([]);
          setHasMore(false);
          return;
        }
        const offset = append ? posts.length : 0;
        const items: Post[] =
          view === 'favorites'
            ? await planetApi.favorites()
            : view === 'mine'
              ? await planetApi.mine()
              : await planetApi.list(
                  category === 'ALL' ? undefined : category,
                  offset,
                );
        setPosts(append ? [...posts, ...items] : items);
        setHasMore(view === 'feed' && items.length === 20);
        void loadViewer(items);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [category, loadViewer, posts, view],
  );

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    void loadRef.current(false);
  }, [view, category, loggedIn]);

  const closeDetail = useCallback(() => {
    setOpenId(null);
    if (window.location.pathname.startsWith('/planet/p/')) {
      window.history.replaceState(null, '', '/planet');
    }
  }, []);

  function switchView(next: View) {
    const url = next === 'feed' ? '/planet' : `/planet?view=${next}`;
    window.history.pushState(null, '', url);
    setView(next);
  }

  function patchPost(id: string, patch: Partial<Post>) {
    setPosts((current) =>
      current.map((post) => (post.id === id ? { ...post, ...patch } : post)),
    );
  }

  async function toggleLike(post: Post) {
    if (!activeAccessToken()) return askLogin();
    try {
      const result = await planetApi.like(post.id);
      patchPost(post.id, { likeCount: result.likeCount });
      setViewer((v) => ({
        ...v,
        [post.id]: {
          favorited: v[post.id]?.favorited ?? false,
          liked: result.liked,
        },
      }));
    } catch (cause) {
      if (cause instanceof PlanetApiError && cause.status === 401)
        return askLogin();
      showToast(cause instanceof Error ? cause.message : '操作失败');
    }
  }

  const tabActive: CommunityTab =
    view === 'favorites' ? 'favorites' : view === 'mine' ? 'mine' : 'planet';

  return (
    <CommunityShell
      active={tabActive}
      onNavigate={(tab) => switchView(tab === 'planet' ? 'feed' : tab)}
    >
      <section className="planet2">
        <header className="planet2-head">
          <div>
            <h1>
              {view === 'favorites'
                ? '我的收藏'
                : view === 'mine'
                  ? '我的分享'
                  : '星芽星球'}
            </h1>
            <p>
              {view === 'feed'
                ? '孩子们的课堂作品、竞赛成果，和星芽的故事。'
                : view === 'favorites'
                  ? '你收藏的作品都在这里。'
                  : '你分享的孩子作品；被拦下待处理的内容只有你自己能看到。'}
            </p>
          </div>
          <button
            type="button"
            className="planet2-share"
            onClick={() =>
              loggedIn ? setSharing(true) : askLogin('登录后即可分享孩子的作品')
            }
          >
            ＋ 分享作品
          </button>
        </header>

        {view === 'feed' && (
          <nav className="planet2-tabs" aria-label="内容分类">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={category === tab.id ? 'is-active' : undefined}
                onClick={() => setCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        {error && (
          <p className="planet2-error" role="alert">
            {error}
          </p>
        )}

        {view !== 'feed' && !loggedIn ? (
          <div className="planet2-empty">
            <p>登录后查看{view === 'favorites' ? '你的收藏' : '你的分享'}。</p>
            <button
              type="button"
              onClick={() => askLogin('登录后查看你的收藏和分享')}
            >
              登录
            </button>
          </div>
        ) : !loading && posts.length === 0 ? (
          <div className="planet2-empty">
            <p>
              {view === 'feed'
                ? '这里还没有内容，敬请期待。'
                : view === 'favorites'
                  ? '还没有收藏，去星球逛逛吧。'
                  : '还没有分享过作品。'}
            </p>
          </div>
        ) : (
          <div className="planet2-masonry">
            {posts.map((post) => (
              <article key={post.id} className="planet2-card">
                <button
                  type="button"
                  className="planet2-card-open"
                  onClick={() => setOpenId(post.id)}
                  aria-label={`查看 ${post.title}`}
                >
                  {post.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media(post.imageUrls[0])}
                      alt={post.title}
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`planet2-card-text is-${post.category.toLowerCase()}`}
                    >
                      <span>{post.body.slice(0, 60) || post.title}</span>
                    </div>
                  )}
                  {post.imageUrls.length > 1 && (
                    <span className="planet2-card-count">
                      {post.imageUrls.length} 图
                    </span>
                  )}
                  <span className="planet2-card-tag">
                    {CATEGORY_LABEL[post.category]}
                  </span>
                </button>
                <div className="planet2-card-body">
                  <h3 onClick={() => setOpenId(post.id)}>
                    {post.pinned && <em>置顶</em>}
                    {post.title}
                  </h3>
                  {post.status && post.status !== 'PUBLISHED' && (
                    <p className="planet2-card-pending">
                      {post.status === 'PENDING_REVIEW'
                        ? '内容待处理，暂不公开'
                        : '已下架'}
                    </p>
                  )}
                  <footer>
                    <span className="planet2-author">
                      <i>{post.authorLabel.slice(0, 1)}</i>
                      {post.studentLabel ?? post.authorLabel}
                    </span>
                    <button
                      type="button"
                      className={`planet2-like ${viewer[post.id]?.liked ? 'is-on' : ''}`}
                      onClick={() => void toggleLike(post)}
                      aria-pressed={viewer[post.id]?.liked ?? false}
                    >
                      <HeartIcon filled={viewer[post.id]?.liked ?? false} />
                      {post.likeCount || ''}
                    </button>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        )}

        {loading && <p className="planet2-loading">正在加载…</p>}
        {hasMore && !loading && (
          <button
            type="button"
            className="planet2-more"
            onClick={() => void load(true)}
          >
            加载更多
          </button>
        )}
      </section>

      {openId && (
        <PostDetail
          id={openId}
          liked={viewer[openId]?.liked ?? false}
          favorited={viewer[openId]?.favorited ?? false}
          onClose={closeDetail}
          onChange={(patch, state) => {
            patchPost(openId, patch);
            if (state)
              setViewer((v) => ({
                ...v,
                [openId]: {
                  ...(v[openId] ?? { liked: false, favorited: false }),
                  ...state,
                },
              }));
          }}
          toast={showToast}
        />
      )}

      {sharing && (
        <ShareDialog
          onClose={() => setSharing(false)}
          onShared={(status) => {
            setSharing(false);
            showToast(
              status === 'PUBLISHED'
                ? '分享成功，已展示在星球'
                : '已提交，内容需要工作人员处理后才会公开',
            );
            switchView('mine');
          }}
        />
      )}

      {toast && (
        <div className="planet2-toast" role="status">
          {toast}
        </div>
      )}
    </CommunityShell>
  );
}

function PostDetail({
  id,
  liked,
  favorited,
  onClose,
  onChange,
  toast,
}: {
  id: string;
  liked: boolean;
  favorited: boolean;
  onClose: () => void;
  onChange: (
    patch: Partial<Post>,
    state?: Partial<{ liked: boolean; favorited: boolean }>,
  ) => void;
  toast: (message: string) => void;
}) {
  const [post, setPost] = useState<PlanetPostDetailView | null>(null);
  const [error, setError] = useState('');
  const [imageIndex, setImageIndex] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    planetApi
      .detail(id)
      .then((detail) => active && setPost(detail))
      .catch(
        (cause: unknown) =>
          active &&
          setError(cause instanceof Error ? cause.message : '加载失败'),
      );
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      active = false;
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [id, onClose]);

  async function act(kind: 'like' | 'favorite') {
    if (!activeAccessToken()) return askLogin();
    try {
      if (kind === 'like') {
        const result = await planetApi.like(id);
        setPost((p) => (p ? { ...p, likeCount: result.likeCount } : p));
        onChange({ likeCount: result.likeCount }, { liked: result.liked });
      } else {
        const result = await planetApi.favorite(id);
        setPost((p) => (p ? { ...p, favoriteCount: result.favoriteCount } : p));
        onChange(
          { favoriteCount: result.favoriteCount },
          { favorited: result.favorited },
        );
        toast(result.favorited ? '已收藏' : '已取消收藏');
      }
    } catch (cause) {
      if (cause instanceof PlanetApiError && cause.status === 401)
        return askLogin();
      toast(cause instanceof Error ? cause.message : '操作失败');
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!activeAccessToken()) return askLogin();
    const body = comment.trim();
    if (!body) return;
    setSending(true);
    try {
      const result = await planetApi.comment(id, body);
      setComment('');
      if (result.status === 'PUBLISHED') {
        setPost((p) =>
          p
            ? {
                ...p,
                commentCount: p.commentCount + 1,
                comments: [result.comment, ...p.comments],
              }
            : p,
        );
        onChange({ commentCount: (post?.commentCount ?? 0) + 1 });
      } else {
        toast('评论需要工作人员处理后才会显示');
      }
    } catch (cause) {
      if (cause instanceof PlanetApiError && cause.status === 401)
        return askLogin();
      toast(cause instanceof Error ? cause.message : '评论失败');
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="planet2-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="planet2-detail"
        role="dialog"
        aria-modal="true"
        aria-label={post?.title ?? '作品详情'}
      >
        <button
          type="button"
          className="planet2-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
        {error ? (
          <p className="planet2-error">{error}</p>
        ) : !post ? (
          <p className="planet2-loading">正在加载…</p>
        ) : (
          <>
            <div className="planet2-detail-media">
              {post.imageUrls.length > 0 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media(post.imageUrls[imageIndex])}
                    alt={post.title}
                  />
                  {post.imageUrls.length > 1 && (
                    <div className="planet2-dots">
                      {post.imageUrls.map((url, index) => (
                        <button
                          key={url}
                          type="button"
                          aria-label={`第 ${index + 1} 张`}
                          className={
                            index === imageIndex ? 'is-active' : undefined
                          }
                          onClick={() => setImageIndex(index)}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div
                  className={`planet2-card-text is-${post.category.toLowerCase()}`}
                >
                  <span>{post.title}</span>
                </div>
              )}
            </div>
            <div className="planet2-detail-side">
              <header>
                <span className="planet2-author">
                  <i>{post.authorLabel.slice(0, 1)}</i>
                  {post.authorLabel}
                  {post.studentLabel ? ` · ${post.studentLabel}` : ''}
                </span>
                <small>
                  {CATEGORY_LABEL[post.category]} · {timeAgo(post.createdAt)}
                </small>
              </header>
              <div className="planet2-detail-text">
                <h2>{post.title}</h2>
                {post.body && <p>{post.body}</p>}
                <h4>共 {post.commentCount} 条评论</h4>
                {post.comments.length === 0 ? (
                  <p className="planet2-muted">
                    还没有评论，来说点鼓励的话吧。
                  </p>
                ) : (
                  <ul className="planet2-comments">
                    {post.comments.map((item) => (
                      <li key={item.id}>
                        <b>{item.authorLabel}</b>
                        <span>{item.body}</span>
                        <small>{timeAgo(item.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <footer className="planet2-detail-actions">
                <form onSubmit={(event) => void send(event)}>
                  <textarea
                    ref={commentRef}
                    rows={1}
                    maxLength={300}
                    value={comment}
                    placeholder={
                      activeAccessToken() ? '说点鼓励的话…' : '登录后参与评论'
                    }
                    onFocus={() => !activeAccessToken() && askLogin()}
                    onChange={(event) => setComment(event.target.value)}
                  />
                  <button type="submit" disabled={sending || !comment.trim()}>
                    发送
                  </button>
                </form>
                <div className="planet2-triple">
                  <button
                    type="button"
                    className={liked ? 'is-on' : undefined}
                    onClick={() => void act('like')}
                    aria-pressed={liked}
                  >
                    <HeartIcon filled={liked} />
                    {post.likeCount}
                  </button>
                  <button
                    type="button"
                    className={favorited ? 'is-on' : undefined}
                    onClick={() => void act('favorite')}
                    aria-pressed={favorited}
                  >
                    <StarIcon filled={favorited} />
                    {post.favoriteCount}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      activeAccessToken()
                        ? commentRef.current?.focus()
                        : askLogin()
                    }
                  >
                    <CommentIcon />
                    {post.commentCount}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sharePost(post, toast)}
                  >
                    <ShareIcon />
                    分享
                  </button>
                </div>
              </footer>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function ShareDialog({
  onClose,
  onShared,
}: {
  onClose: () => void;
  onShared: (status: string) => void;
}) {
  const [category, setCategory] = useState<'WORK' | 'COMPETITION'>('WORK');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [initial, setInitial] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of [...files].slice(0, 9 - images.length)) {
        urls.push((await planetApi.upload(await compressImage(file))).url);
      }
      setImages((current) => [...current, ...urls]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!title.trim()) return setError('请填写标题');
    if (images.length === 0 && !body.trim())
      return setError('请至少上传一张图片或写几句介绍');
    if (initial && !/^[\u4e00-\u9fa5A-Za-z]$/.test(initial.trim())) {
      return setError('孩子称呼只填一个字');
    }
    if (!consent) return setError('请勾选监护人同意');
    setSaving(true);
    try {
      const result = await planetApi.share({
        category,
        title: title.trim(),
        body: body.trim(),
        imageUrls: images,
        ...(initial.trim() ? { studentInitial: initial.trim() } : {}),
        guardianConsent: true,
      });
      onShared(result.status);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '分享失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="planet2-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="planet2-share-dialog"
        onSubmit={(event) => void submit(event)}
        role="dialog"
        aria-modal="true"
        aria-label="分享作品"
      >
        <button
          type="button"
          className="planet2-close"
          onClick={onClose}
          aria-label="关闭"
        >
          ×
        </button>
        <h2>分享孩子的作品</h2>
        <div className="planet2-segment">
          {(['WORK', 'COMPETITION'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={category === value ? 'is-active' : undefined}
              onClick={() => setCategory(value)}
            >
              {CATEGORY_LABEL[value]}
            </button>
          ))}
        </div>
        <div className="planet2-upload">
          {images.map((url) => (
            <figure key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={media(url)} alt="已上传" />
              <button
                type="button"
                aria-label="移除"
                onClick={() => setImages(images.filter((item) => item !== url))}
              >
                ×
              </button>
            </figure>
          ))}
          {images.length < 9 && (
            <label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                disabled={uploading}
                onChange={(event) => {
                  void addImages(event.target.files);
                  event.target.value = '';
                }}
              />
              {uploading ? '上传中…' : `＋ 图片 ${images.length}/9`}
            </label>
          )}
        </div>
        <input
          maxLength={60}
          value={title}
          placeholder="标题，例如：AI 绘画打卡第 3 天"
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          rows={4}
          maxLength={2000}
          value={body}
          placeholder="说说作品背后的故事…"
          onChange={(event) => setBody(event.target.value)}
        />
        <input
          maxLength={1}
          value={initial}
          placeholder="孩子称呼（选填，只填一个字，显示为“小X”）"
          onChange={(event) => setInitial(event.target.value)}
        />
        <label className="planet2-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          我是孩子的监护人，同意在星芽星球展示这些内容。请勿上传含孩子全名、学校、住址等信息的图片。
        </label>
        {error && (
          <p className="planet2-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="planet2-submit"
          disabled={saving || uploading}
        >
          {saving ? '发布中…' : '发布'}
        </button>
      </form>
    </div>
  );
}
