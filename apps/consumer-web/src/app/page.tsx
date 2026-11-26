'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AppointmentForm } from './appointment-form';
import { ConsumerAuthChrome, enterPlanetOrRequestAuth } from './consumer-auth';

const HERO_ITEMS = [
  {
    src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png',
    bg: '#F4845F',
    panel: '#F79B7F',
    label: 'AI 创作课',
    fallback: '#f4845f',
  },
  {
    src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png',
    bg: '#6BBF7A',
    panel: '#85CC92',
    label: '提示词训练',
    fallback: '#6bbf7a',
  },
  {
    src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png',
    bg: '#E882B4',
    panel: '#ED9DC4',
    label: '成长作品集',
    fallback: '#e882b4',
  },
  {
    src: 'https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png',
    bg: '#6EB5FF',
    panel: '#8DC4FF',
    label: 'AI 项目课',
    fallback: '#6eb5ff',
  },
] as const;

const PRODUCTS = [
  ['99元体验课', '1课时', '首次了解AI课堂，现场完成小作品，获得学习建议。'],
  ['学期课', '4480元 / 2个月', '16课时线下课 + 8课时答疑课，共24课时。'],
  ['AI亲子营', '980元', '亲子一起体验AI创作，假期到店、作品展示。'],
] as const;

const STEPS = [
  ['主题导入', '用故事、任务或真实问题进入课堂。'],
  ['AI共创', '孩子动手提问、生成、筛选和修改。'],
  ['老师点评', '老师帮助孩子说清楚作品思路。'],
  ['作品入档', '每次成果进入个人成长档案。'],
] as const;

const PATHS = [
  [
    '6-8岁',
    '星芽启萌',
    'AI认知、故事表达、创意绘本。',
    '认识AI能做什么，用图像、声音和故事完成第一件作品。',
    '培养表达兴趣',
  ],
  [
    '9-11岁',
    '星芽探索',
    '创意生成、提示词、作品迭代。',
    '围绕一个主题生成素材、筛选方案，并改出更完整的作品。',
    '形成创作方法',
  ],
  [
    '12-15岁',
    '星芽创新',
    '项目发布、表达展示、问题解决。',
    '把想法整理成可展示的应用原型、短视频或主题项目。',
    '完成独立作品',
  ],
] as const;

const THINKING = [
  ['提问意识', '把模糊想法变成清楚的问题。'],
  ['判断能力', '比较不同结果，说明为什么选择这一版。'],
  ['表达结构', '讲清目标、过程和作品亮点。'],
  ['迭代习惯', '愿意修改、复盘，再做出更好的一版。'],
] as const;

const EVENTS = [
  ['7月18日 14:00', 'AI体验开放日', '1课时到店体验'],
  ['7月19日 15:30', '创意挑战赛', '孩子创意挑战'],
  ['7月25日 19:30', '家长AI沙龙', '家长理解AI教育'],
  ['8月2日 16:00', '作品展示', '阶段成果开放看'],
] as const;

const TEACHERS = [
  ['林老师', 'AI创作导师', 0, '引导想法表达'],
  ['周老师', '项目导师', 3, '陪伴项目迭代'],
  ['陈老师', '家长沟通导师', 2, '同步课堂反馈'],
  ['许老师', '作品展示导师', 1, '训练表达展示'],
] as const;

function roleFor(index: number, activeIndex: number) {
  if (index === activeIndex) return 'center';
  if (index === (activeIndex + 3) % 4) return 'left';
  if (index === (activeIndex + 1) % 4) return 'right';
  return 'back';
}

function HeroImage({
  src,
  alt,
  fallback,
}: {
  src: string;
  alt: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="toon-character-fallback"
        style={{ backgroundColor: fallback }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function DisplayFigure({ src, fallback }: { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="toon-card-figure"
        style={{ backgroundColor: fallback }}
        aria-hidden="true"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="toon-card-figure"
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}

export default function Home() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [copySwapping, setCopySwapping] = useState(false);
  const current = HERO_ITEMS[activeIndex];
  const router = useRouter();

  const onPlanetEntry = useCallback(
    (event?: { preventDefault: () => void }) => {
      event?.preventDefault();
      enterPlanetOrRequestAuth((href) => router.push(href));
    },
    [router],
  );

  const navigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (animating) return;
      setAnimating(true);
      setActiveIndex((index) =>
        direction === 'next'
          ? (index + 1) % HERO_ITEMS.length
          : (index + HERO_ITEMS.length - 1) % HERO_ITEMS.length,
      );
      setCopySwapping(true);
      window.setTimeout(() => {
        setCopySwapping(false);
        setAnimating(false);
      }, 650);
    },
    [animating],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') navigate('prev');
      if (event.key === 'ArrowRight') navigate('next');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    document.body.style.backgroundColor = current.bg;
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [current.bg]);

  return (
    <div className="toon-page" style={{ backgroundColor: current.bg }}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <section
        className={`toon-hero${copySwapping ? ' is-copy-swapping' : ''}`}
        style={
          {
            '--hero-bg': current.bg,
            '--hero-panel': current.panel,
          } as CSSProperties
        }
      >
        <div className="toon-hero-inner" id="top">
          <div className="toon-grain" aria-hidden="true" />
          <div className="toon-ghost">AI 课堂</div>
          <header className="toon-nav">
            <a href="#top">星芽AI</a>
            <nav aria-label="网站导航">
              <a href="/planet" onClick={onPlanetEntry}>
                星芽星球
              </a>
              <a href="/lab">互动实验室</a>
              <a href="#products">产品</a>
              <a href="#path">课程</a>
              <a href="#events">活动</a>
            </nav>
            <div className="toon-nav-actions">
              <ConsumerAuthChrome variant="toon" />
            </div>
          </header>

          <div className="toon-carousel" aria-label="星芽 AI 首屏轮播">
            {HERO_ITEMS.map((item, index) => (
              <figure
                key={item.label}
                className={`toon-character is-${roleFor(index, activeIndex)}`}
                data-hero-index={index}
              >
                <HeroImage
                  src={item.src}
                  alt={item.label}
                  fallback={item.fallback}
                />
              </figure>
            ))}
          </div>

          <div className="toon-copy">
            <p data-hero-label>{current.label}</p>
            <span>
              青少年 AI
              实践学院。从体验入门到系统学习，让孩子在真实项目里完成作品。
            </span>
            <a className="toon-hero-cta" href="#appointment">
              预约体验
            </a>
            <div className="toon-arrows">
              <button
                type="button"
                aria-label="上一个轮播项"
                onClick={() => navigate('prev')}
              >
                ←
              </button>
              <button
                type="button"
                aria-label="下一个轮播项"
                onClick={() => navigate('next')}
              >
                →
              </button>
            </div>
          </div>

          <a
            className="toon-planet-shortcut"
            href="/planet"
            onClick={onPlanetEntry}
          >
            星芽星球 <span>→</span>
          </a>
        </div>
      </section>

      <main id="main-content">
        <section className="toon-section toon-manifesto" id="products">
          <div className="toon-section-label">课程产品</div>
          <h2>产品介绍</h2>
          <div className="toon-loop">
            {PRODUCTS.map((item, index) => (
              <article key={item[0]}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item[0]}</strong>
                <em>{item[1]}</em>
                <p>{item[2]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="toon-section toon-method" id="classroom">
          <div className="toon-section-label">课堂体验</div>
          <h2>一节课怎么发生。</h2>
          <div className="toon-steps">
            {STEPS.map((item, index) => (
              <article key={item[0]}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{item[0]}</strong>
                <p>{item[1]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="toon-section toon-showcase" id="path">
          <div className="toon-display-card">
            <DisplayFigure
              src={HERO_ITEMS[1].src}
              fallback={HERO_ITEMS[1].fallback}
            />
            <span>成长路径</span>
            <h2>按年龄进阶。</h2>
            <p>从AI认知，到创意生成，再到项目发布。</p>
          </div>
          <div className="toon-gallery">
            {PATHS.map((item) => (
              <article
                key={item[1]}
                tabIndex={0}
                aria-label={`${item[0]} ${item[1]}，悬停或聚焦查看详情`}
              >
                <div className="toon-flip-card">
                  <div className="toon-flip-face toon-flip-front">
                    <span>{item[0]}</span>
                    <strong>{item[1]}</strong>
                    <p>{item[2]}</p>
                  </div>
                  <div className="toon-flip-face toon-flip-back">
                    <span>课程详情</span>
                    <p>{item[3]}</p>
                    <strong>{item[4]}</strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="toon-section toon-thinking">
          <div>
            <div className="toon-section-label">思维培养</div>
            <h2>AI思维培养。</h2>
            <p>
              AI课堂不是只学工具，而是训练孩子把想法说清楚、把结果看明白、把作品改得更好。
            </p>
          </div>
          <div className="toon-thinking-grid">
            {THINKING.map((item) => (
              <article key={item[0]}>
                <strong>{item[0]}</strong>
                <p>{item[1]}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="toon-section toon-report" id="community">
          <div className="toon-report-panel">
            <div className="toon-section-label">星芽星球</div>
            <h2>家长看见每一次进步。</h2>
            <p>作品、老师点评和阶段成果，沉淀成孩子的AI成长档案。</p>
            <a href="/planet" onClick={onPlanetEntry}>
              进入星球
            </a>
          </div>
          <div className="toon-score-card">
            <span>学习成果</span>
            <strong>4项</strong>
            <p>作品集、课堂点评、阶段记录和展示反馈统一进入星芽星球。</p>
          </div>
        </section>

        <section className="toon-section toon-console" id="events">
          <div>
            <div className="toon-section-label">活动预告</div>
            <h2>先体验，再决定。</h2>
            <p>开放日、挑战赛、家长沙龙，先看真实课堂。</p>
          </div>
          <div className="toon-browser">
            <div className="toon-browser-bar">
              <span />
              <span />
              <span />
              <b>xingya.ai/events</b>
            </div>
            <div className="toon-browser-grid">
              {EVENTS.map((item) => (
                <article key={item[1]}>
                  <span>{item[0]}</span>
                  <strong>{item[1]}</strong>
                  <small>{item[2]}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="toon-section toon-access" id="teachers">
          <div className="toon-access-copy">
            <div className="toon-section-label">师资与校区</div>
            <h2>师资与校区</h2>
            <p>师资雄厚，高学历导师团队，兼顾AI创作、项目引导和家长沟通。</p>
          </div>
          <div className="toon-access-grid">
            {TEACHERS.map((item) => (
              <article className="toon-teacher-card" key={item[0]}>
                <div className="toon-avatar">
                  <HeroImage
                    src={HERO_ITEMS[item[2]].src}
                    alt=""
                    fallback={HERO_ITEMS[item[2]].fallback}
                  />
                </div>
                <span>虚拟占位</span>
                <strong>{item[0]}</strong>
                <em>{item[1]}</em>
                <p>{item[3]}</p>
              </article>
            ))}
            <article className="toon-address-card" id="campus">
              <span>到店地址</span>
              <strong>深圳市南山区深云路2号</strong>
              <p>预约到店体验，现场了解课堂环境。</p>
              <a href="#appointment">预约到店</a>
            </article>
          </div>
        </section>

        <section className="toon-section toon-cta" id="appointment">
          <p>星芽AI</p>
          <h2>上一节真正的AI课。</h2>
          <AppointmentForm />
        </section>
      </main>
    </div>
  );
}
