'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminPlanetPostView } from '@budstar/contracts';
import {
  AdminApiClient,
  ApiRequestError,
  SessionExpiredError,
} from '../auth-client';
import { compressImage } from '../image-compress';
import { OpsShell } from '../ops-shell';
import { CATEGORY_LABELS, STATUS_LABELS } from './labels';

const MEDIA_ORIGIN = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api'
).replace(/\/api\/?$/, '');

const EMPTY_FORM = {
  category: 'WORK',
  title: '',
  body: '',
  studentInitial: '',
  guardianConsent: false,
  pinned: false,
};

export default function PlanetAdminPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [posts, setPosts] = useState<AdminPlanetPostView[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fail = useCallback((cause: unknown) => {
    if (cause instanceof SessionExpiredError) {
      window.location.replace('/login');
      return;
    }
    setError(
      cause instanceof ApiRequestError || cause instanceof Error
        ? cause.message
        : '操作失败，请重试',
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setPosts(await client.listPlanetPosts(statusFilter || undefined));
    } catch (cause) {
      fail(cause);
    }
  }, [client, fail, statusFilter]);

  useEffect(() => {
    if (!client.readSession()) {
      window.location.replace('/login');
      return;
    }
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [client, load]);

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    setUploading(true);
    try {
      const room = 9 - images.length;
      const picked = [...files].slice(0, room);
      const urls: string[] = [];
      for (const file of picked) {
        urls.push(
          (await client.uploadPlanetImage(await compressImage(file))).url,
        );
      }
      setImages((current) => [...current, ...urls]);
      if (files.length > room) setNotice('最多 9 张图片，多余的已忽略');
    } catch (cause) {
      fail(cause);
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setNotice('');
    const initial = form.studentInitial.trim();
    if (!form.title.trim()) return setError('请填写标题');
    if (initial && !/^[\u4e00-\u9fa5A-Za-z]$/.test(initial)) {
      return setError('孩子称呼只填一个字，例如“星”，前台显示为“小星”');
    }
    if (initial && !form.guardianConsent) {
      return setError('涉及孩子的内容，请先勾选“已取得监护人授权”');
    }
    setSaving(true);
    try {
      await client.createPlanetPost({
        category: form.category,
        title: form.title.trim(),
        body: form.body.trim(),
        imageUrls: images,
        ...(initial ? { studentInitial: initial } : {}),
        guardianConsent: form.guardianConsent,
        pinned: form.pinned,
      });
      setForm(EMPTY_FORM);
      setImages([]);
      setNotice('已发布到星芽星球');
      await load();
    } catch (cause) {
      fail(cause);
    } finally {
      setSaving(false);
    }
  }

  async function update(
    id: string,
    patch: { status?: string; pinned?: boolean },
  ) {
    setError('');
    try {
      await client.updatePlanetPost(id, patch);
      await load();
    } catch (cause) {
      fail(cause);
    }
  }

  return (
    <OpsShell active="planet">
      <header className="ops-page-head">
        <div>
          <h1>星球内容</h1>
          <p>
            发布学生作品、竞赛成果、公司文化与课程内容；家长分享的作品也在这里管理。
          </p>
        </div>
      </header>

      {error && (
        <div className="ops-login-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="ops-login-hint" role="status">
          {notice}
        </p>
      )}

      <div className="planet-admin">
        <form
          className="planet-admin-form"
          onSubmit={(event) => void submit(event)}
        >
          <h2>发布新内容</h2>
          <label>
            分类
            <select
              value={form.category}
              onChange={(event) =>
                setForm({ ...form, category: event.target.value })
              }
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            标题
            <input
              maxLength={60}
              value={form.title}
              placeholder="例如：AI 绘画课堂作品｜我的未来城市"
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <label>
            正文
            <textarea
              rows={5}
              maxLength={2000}
              value={form.body}
              placeholder="介绍作品、比赛或活动的故事"
              onChange={(event) =>
                setForm({ ...form, body: event.target.value })
              }
            />
          </label>
          <div className="planet-admin-images">
            {images.map((url) => (
              <figure key={url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${MEDIA_ORIGIN}${url}`} alt="已上传图片" />
                <button
                  type="button"
                  aria-label="移除图片"
                  onClick={() =>
                    setImages(images.filter((item) => item !== url))
                  }
                >
                  ×
                </button>
              </figure>
            ))}
            {images.length < 9 && (
              <label className="planet-admin-add">
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
                {uploading ? '上传中…' : `+ 添加图片（${images.length}/9）`}
              </label>
            )}
          </div>
          <label>
            孩子称呼（选填，只填一个字）
            <input
              maxLength={1}
              value={form.studentInitial}
              placeholder="例如：星 → 前台显示“小星”"
              onChange={(event) =>
                setForm({ ...form, studentInitial: event.target.value })
              }
            />
          </label>
          <label className="planet-admin-check">
            <input
              type="checkbox"
              checked={form.guardianConsent}
              onChange={(event) =>
                setForm({ ...form, guardianConsent: event.target.checked })
              }
            />
            已取得监护人授权（内容涉及孩子照片、作品或称呼时必须勾选）
          </label>
          <label className="planet-admin-check">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(event) =>
                setForm({ ...form, pinned: event.target.checked })
              }
            />
            置顶
          </label>
          <button className="ops-primary" disabled={saving || uploading}>
            {saving ? '发布中…' : '发布'}
          </button>
        </form>

        <section className="planet-admin-list">
          <div className="planet-admin-filter">
            {[['', '全部'], ...Object.entries(STATUS_LABELS)].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? 'is-active' : undefined}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          {posts.length === 0 ? (
            <p className="ops-login-hint">暂无内容。</p>
          ) : (
            posts.map((post) => (
              <article key={post.id} className="planet-admin-item">
                {post.imageUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${MEDIA_ORIGIN}${post.imageUrls[0]}`} alt="" />
                ) : (
                  <span className="planet-admin-noimg">
                    {CATEGORY_LABELS[post.category]?.slice(0, 2)}
                  </span>
                )}
                <div>
                  <b>
                    {post.pinned && <em>置顶</em>}
                    {post.title}
                  </b>
                  <small>
                    {CATEGORY_LABELS[post.category]} ·{' '}
                    {post.authorKind === 'STAFF'
                      ? '员工发布'
                      : `家长分享（${post.authorLabel}）`}
                    {post.studentLabel ? ` · ${post.studentLabel}` : ''} ·{' '}
                    {new Date(post.createdAt).toLocaleString('zh-CN')}
                  </small>
                  <small>
                    赞 {post.likeCount} · 收藏 {post.favoriteCount} · 评论{' '}
                    {post.commentCount}
                  </small>
                  {post.reviewReason && (
                    <small className="planet-admin-reason">
                      待处理原因：{post.reviewReason}
                    </small>
                  )}
                </div>
                <div className="planet-admin-actions">
                  <span
                    className={`planet-status is-${post.status.toLowerCase()}`}
                  >
                    {STATUS_LABELS[post.status]}
                  </span>
                  {post.status !== 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() =>
                        void update(post.id, { status: 'PUBLISHED' })
                      }
                    >
                      展示
                    </button>
                  )}
                  {post.status !== 'REMOVED' && (
                    <button
                      type="button"
                      onClick={() =>
                        void update(post.id, { status: 'REMOVED' })
                      }
                    >
                      下架
                    </button>
                  )}
                  {post.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() =>
                        void update(post.id, { pinned: !post.pinned })
                      }
                    >
                      {post.pinned ? '取消置顶' : '置顶'}
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </OpsShell>
  );
}
