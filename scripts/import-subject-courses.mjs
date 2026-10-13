#!/usr/bin/env node
/**
 * 学科内容批量导入（K12+高中 全科互动实验室）
 *
 * 用法：
 *   node scripts/import-subject-courses.mjs [--dry-run] [--copy] [--api <baseUrl>]
 *
 * 规则（已与用户对齐的去重决定）：
 *   - 数学：只取「按知识点归类」整合版，跳过 4 个分包（内容重复）与 zip
 *   - 英语：取「发音优化版」，跳过「离线合集」（重复）与 index.html 导航页
 *   - 全局跳过 zip、验收证据、.DS_Store、非 HTML
 *   - 每个知识域/完整包 = 一个 SubjectCourse 草稿；包内编号 HTML = 章节
 *   - HTML 文件复制到 apps/api/storage/subject-courses/，DB 存元数据 + contentUrl
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--copy') && !args.includes('--api');
const DO_COPY = args.includes('--copy');

const SOURCE_ROOT =
  process.argv.find((a) => a.startsWith('--source='))?.slice(9) ??
  '/Users/80419400/Downloads/K12+高中 全科互动实验室开发成果';
const STORAGE_ROOT = path.resolve('apps/api/storage/subject-courses');
const MANIFEST_PATH = path.resolve('docs/subject-course-import-manifest.json');

const SUBJECTS = {
  数学: 'MATH',
  语文: 'CHINESE',
  英语: 'ENGLISH',
  物理: 'PHYSICS',
  化学: 'CHEMISTRY',
  生物: 'BIOLOGY',
};

const SKIP_DIRS = ['验收证据', '.git'];
const SKIP_PACKAGES = [
  // 数学分包由「按知识点归类」整合版覆盖
  '数学互动实验室_12主题_迁移图文答卷版',
  '数学互动实验室_数与代数及方程不等式_15主题',
  '数学互动实验室_统计与概率_3主题',
  '数学互动实验室_高一基础核心_12主题',
  // 英语离线合集与发音优化版重复
  '英语互动实验室_27专题_离线合集',
];

function gradeOf(name) {
  // 跨学段包（同时出现多个学段关键词）→ GENERAL
  const bands = [
    name.includes('小学') && 'PRIMARY',
    name.includes('初中') && 'JUNIOR_HIGH',
    (name.includes('高中') || name.includes('高一') || name.includes('高二')) &&
      'SENIOR_HIGH',
  ].filter(Boolean);
  if (bands.length > 1) return { gradeBand: 'GENERAL', gradeLevel: null };
  if (name.includes('小学')) return { gradeBand: 'PRIMARY', gradeLevel: null };
  if (name.includes('初中'))
    return { gradeBand: 'JUNIOR_HIGH', gradeLevel: null };
  if (name.includes('高一') && name.includes('高二'))
    return { gradeBand: 'SENIOR_HIGH', gradeLevel: null };
  if (name.includes('高一'))
    return { gradeBand: 'SENIOR_HIGH', gradeLevel: 10 };
  if (name.includes('高二'))
    return { gradeBand: 'SENIOR_HIGH', gradeLevel: 11 };
  if (name.includes('高中') || name.includes('选择性必修'))
    return { gradeBand: 'SENIOR_HIGH', gradeLevel: null };
  return { gradeBand: 'GENERAL', gradeLevel: null };
}

function listHtmls(dir, recursive = false) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name.startsWith('.') ||
      SKIP_DIRS.some((s) => entry.name.includes(s))
    )
      continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...listHtmls(full, true));
    } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
      out.push(full);
    }
  }
  return out;
}

function chapterTitleFromFile(file) {
  const base = path.basename(file, '.html');
  return base
    .replace(/^\d+[、_\-.\s]+/, '')
    .replace(/_互动实验室$/, '')
    .replace(/_?互动实验室$/, '')
    .trim();
}

function sequenceOf(file) {
  // 只认 1~2 位编号前缀；m034/2026 等技术编号不算章节序
  const m = path.basename(file).match(/^(\d{1,2})[、_\-.\s]/);
  return m ? Number(m[1]) : 0;
}

const courses = [];
for (const [cnSubject, subject] of Object.entries(SUBJECTS)) {
  const subjectDir = path.join(SOURCE_ROOT, cnSubject);
  if (!fs.existsSync(subjectDir)) continue;

  if (subject === 'MATH') {
    // 数学：按知识点归类的六个知识域各成一个课程
    const root = path.join(subjectDir, '数学互动实验室——按知识点归类');
    for (const area of fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))) {
      const files = listHtmls(path.join(root, area.name)).sort(
        (a, b) => sequenceOf(a) - sequenceOf(b),
      );
      if (!files.length) continue;
      const areaName = area.name.replace(/（.*?）/, '').trim();
      courses.push({
        subject,
        title: `数学·${areaName}`,
        ...gradeOf(area.name),
        sourceDir: path.join(root, area.name),
        files,
      });
    }
    continue;
  }

  for (const entry of fs.readdirSync(subjectDir, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith('.') ||
      SKIP_DIRS.some((s) => entry.name.includes(s))
    )
      continue;
    if (SKIP_PACKAGES.includes(entry.name)) continue;
    // 物理/化学等：包目录（或其唯一子目录）里的 HTML
    let files = listHtmls(path.join(subjectDir, entry.name));
    if (files.length === 0) {
      const subs = fs
        .readdirSync(path.join(subjectDir, entry.name), { withFileTypes: true })
        .filter((e) => e.isDirectory());
      for (const sub of subs)
        files.push(...listHtmls(path.join(subjectDir, entry.name, sub.name)));
    }
    files.sort((a, b) => sequenceOf(a) - sequenceOf(b));
    if (!files.length) continue;
    const pkgName = entry.name
      .replace(/_?完整包/, '')
      .replace(/（.*?）/, '')
      .replace(/_?\d+项|_?\d+专题|_?\d+主题/g, '')
      .replace(/_独立HTML互动实验室|互动实验室/g, '')
      .replace(/^[_|]+|[_|]+$/g, '')
      .trim();
    courses.push({
      subject,
      title: pkgName || entry.name,
      ...gradeOf(entry.name),
      sourceDir: path.join(subjectDir, entry.name),
      files,
    });
  }
}

// 汇总 + 复制
const manifest = [];
let courseNo = 0;
for (const course of courses) {
  courseNo += 1;
  const slug = `${course.subject.toLowerCase()}-${String(courseNo).padStart(2, '0')}`;
  const chapters = course.files.map((file, index) => {
    const dest = path.join(STORAGE_ROOT, slug, path.basename(file));
    return {
      sequence: sequenceOf(file) || index + 1,
      title: chapterTitleFromFile(file),
      contentHtml: '',
      contentUrl: `/api/static/subject-courses?path=${encodeURIComponent(`${slug}/${path.basename(file)}`)}`,
      sourceFile: file,
      destFile: dest,
      sizeKb: Math.round(fs.statSync(file).size / 1024),
    };
  });
  manifest.push({
    slug,
    subject: course.subject,
    gradeBand: course.gradeBand,
    gradeLevel: course.gradeLevel,
    title: `${course.title}`,
    sourceDir: course.sourceDir,
    chapters,
  });
  if (DO_COPY) {
    fs.mkdirSync(path.join(STORAGE_ROOT, slug), { recursive: true });
    for (const ch of chapters) fs.copyFileSync(ch.sourceFile, ch.destFile);
  }
}

fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

// 报告
console.log(
  `共 ${manifest.length} 个学科内容课程，${manifest.reduce((n, c) => n + c.chapters.length, 0)} 个章节（HTML）`,
);
const byKey = {};
for (const c of manifest) {
  const k = `${c.subject}/${c.gradeBand}${c.gradeLevel ?? ''}`;
  byKey[k] = byKey[k] || { courses: 0, chapters: 0 };
  byKey[k].courses += 1;
  byKey[k].chapters += c.chapters.length;
}
for (const [k, v] of Object.entries(byKey))
  console.log(`  ${k}: ${v.courses} 门 / ${v.chapters} 章`);
console.log(
  DRY_RUN
    ? '（dry-run：仅生成 manifest，未复制文件）'
    : `文件已复制到 ${STORAGE_ROOT}`,
);
console.log(`manifest: ${MANIFEST_PATH}`);

// --api 模式：登录平台管理员并创建草稿
if (args.includes('--api')) {
  const base = args[args.indexOf('--api') + 1] ?? 'http://localhost:3001/api';
  const login = await fetch(`${base}/auth/platform/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginIdentifier: 'platform@local',
      password: 'Platform123!',
    }),
  }).then((r) => r.json());
  const verified = await fetch(`${base}/auth/platform/verify-second-factor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeToken: login.challengeToken,
      code: '000000',
    }),
  }).then((r) => r.json());
  const token = verified.accessToken;
  let ok = 0;
  for (const course of manifest) {
    const res = await fetch(`${base}/platform/subject-courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        subject: course.subject,
        gradeBand: course.gradeBand,
        gradeLevel: course.gradeLevel ?? null,
        title: course.title,
        chapters: course.chapters.map((ch) => ({
          sequence: ch.sequence,
          title: ch.title,
          contentHtml: '',
          contentUrl: ch.contentUrl,
        })),
      }),
    });
    if (res.ok) ok += 1;
    else
      console.error(
        `创建失败 ${course.title}: ${res.status}`,
        await res.text(),
      );
  }
  console.log(`API 导入完成：${ok}/${manifest.length}`);
}
