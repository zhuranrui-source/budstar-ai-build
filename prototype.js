/* Xingya AI public landing page. Inspired by the pasted TOONHUB hero spec; implemented in static JS for this repo. */
const HERO_ITEMS = [
  {
    src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/1.02464a56.png",
    bg: "#F4845F",
    panel: "#F79B7F",
    label: "AI 创作课",
    title: "完成第一张 AI 海报",
    lesson: "AIGC 创作入门",
  },
  {
    src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/2.b977faab.png",
    bg: "#6BBF7A",
    panel: "#85CC92",
    label: "提示词训练",
    title: "学会提问、迭代和表达",
    lesson: "AI 学习方法",
  },
  {
    src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/3.4df853b4.png",
    bg: "#E882B4",
    panel: "#ED9DC4",
    label: "成长作品集",
    title: "每节课都有作品沉淀",
    lesson: "家长可见成果",
  },
  {
    src: "https://fifth-gentle-45902158.figma.site/_components/v2/4de492f6d9cf8244ad5293233e5c6f52407d42fc/4.4457fbce.png",
    bg: "#6EB5FF",
    panel: "#8DC4FF",
    label: "Vibe Coding",
    title: "做出一个可展示的小产品",
    lesson: "AI 编程启蒙",
  },
];

const root = document.querySelector("#prototype-root");
let activeIndex = 0;
let isAnimating = false;

HERO_ITEMS.forEach((item) => {
  const image = new Image();
  image.src = item.src;
});

render();
applyHeroState();

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-hero-nav]");
  if (control) {
    navigate(control.dataset.heroNav);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    navigate("prev");
  }

  if (event.key === "ArrowRight") {
    navigate("next");
  }
});

function navigate(direction) {
  if (isAnimating) return;
  isAnimating = true;
  activeIndex = direction === "next"
    ? (activeIndex + 1) % HERO_ITEMS.length
    : (activeIndex + HERO_ITEMS.length - 1) % HERO_ITEMS.length;
  applyHeroState(true);

  window.setTimeout(() => {
    isAnimating = false;
  }, 650);
}

function roleFor(index) {
  if (index === activeIndex) return "center";
  if (index === (activeIndex + 3) % 4) return "left";
  if (index === (activeIndex + 1) % 4) return "right";
  return "back";
}

function render() {
  root.innerHTML = `
    <section class="toon-hero" style="--hero-bg:${HERO_ITEMS[activeIndex].bg};--hero-panel:${HERO_ITEMS[activeIndex].panel}">
      ${renderHero()}
    </section>
    ${renderLanding()}
  `;
}

function applyHeroState(shouldReplayCopy = false) {
  const current = HERO_ITEMS[activeIndex];
  const hero = document.querySelector(".toon-hero");
  const page = document.querySelector(".toon-page");

  document.body.style.backgroundColor = current.bg;
  page?.style.setProperty("background-color", current.bg);
  hero?.style.setProperty("--hero-bg", current.bg);
  hero?.style.setProperty("--hero-panel", current.panel);

  document.querySelectorAll("[data-hero-index]").forEach((element) => {
    const index = Number(element.dataset.heroIndex);
    element.className = `toon-character is-${roleFor(index)}`;
  });

  const label = document.querySelector("[data-hero-label]");

  if (label) label.textContent = current.label;

  if (shouldReplayCopy && hero) {
    hero.classList.remove("is-copy-swapping");
    void hero.offsetWidth;
    hero.classList.add("is-copy-swapping");
    window.setTimeout(() => {
      hero.classList.remove("is-copy-swapping");
    }, 650);
  }
}

function renderHero() {
  const current = HERO_ITEMS[activeIndex];

  return `
    <div class="toon-hero-inner" id="top">
      <div class="toon-grain" aria-hidden="true"></div>
      <div class="toon-ghost">AI 课堂</div>
      <header class="toon-nav">
        <a href="#top">星芽AI</a>
        <nav aria-label="网站导航">
          <a href="#products">产品</a>
          <a href="#path">课程</a>
          <a href="#events">活动</a>
          <a href="#community">社区</a>
        </nav>
      </header>

      <div class="toon-carousel" aria-label="BudStar AI 首屏轮播">
        ${HERO_ITEMS.map((item, index) => `
          <figure class="toon-character is-${roleFor(index)}" data-hero-index="${index}">
            <img src="${item.src}" alt="${item.label}" draggable="false" />
          </figure>
        `).join("")}
      </div>

      <div class="toon-copy">
        <p data-hero-label>${current.label}</p>
        <span>青少年 AI 实践学院。从体验入门到系统学习，让孩子在真实项目里完成作品。</span>
        <div class="toon-arrows">
          <button type="button" data-hero-nav="prev" aria-label="上一个轮播项">←</button>
          <button type="button" data-hero-nav="next" aria-label="下一个轮播项">→</button>
        </div>
      </div>

      <a class="toon-discover" href="#products">
        预约体验 <span>→</span>
      </a>
    </div>
  `;
}

function renderLanding() {
  return `
    <section class="toon-section toon-manifesto" id="products">
      <div class="toon-section-label">课程产品</div>
      <h2>产品介绍</h2>
      <div class="toon-loop">
        ${[
          ["99元体验课", "1课时", "首次了解AI课堂，现场完成小作品，获得学习建议。"],
          ["学期课", "4480元 / 2个月", "16课时线下课 + 8课时答疑课，共24课时。"],
          ["AI亲子营", "980元", "亲子一起体验AI创作，假期到店、作品展示。"],
        ].map((item, index) => `
          <article>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${item[0]}</strong>
            <em>${item[1]}</em>
            <p>${item[2]}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="toon-section toon-method" id="classroom">
      <div class="toon-section-label">课堂体验</div>
      <h2>一节课怎么发生。</h2>
      <div class="toon-steps">
        ${[
          ["主题导入", "用故事、任务或真实问题进入课堂。"],
          ["AI共创", "孩子动手提问、生成、筛选和修改。"],
          ["老师点评", "老师帮助孩子说清楚作品思路。"],
          ["作品入档", "每次成果进入个人成长档案。"],
        ].map((item, index) => `
          <article>
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${item[0]}</strong>
            <p>${item[1]}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="toon-section toon-showcase" id="path">
      <div class="toon-display-card">
        <img class="toon-card-figure" src="${HERO_ITEMS[1].src}" alt="" aria-hidden="true" />
        <span>成长路径</span>
        <h2>按年龄进阶。</h2>
        <p>从AI认知，到Python应用，再到项目发布。</p>
      </div>
      <div class="toon-gallery">
        <article><span>6-8岁</span><strong>星芽启萌</strong><p>故事、对话、创意。</p></article>
        <article><span>9-11岁</span><strong>星芽探索</strong><p>提示词、Python、工具。</p></article>
        <article><span>12-15岁</span><strong>星芽创新</strong><p>项目、调试、发布。</p></article>
      </div>
    </section>

    <section class="toon-section toon-outcomes">
      <div>
        <div class="toon-section-label">学习成果</div>
        <h2>孩子带走的不只是工具。</h2>
        <p>星芽AI把每次课堂结果沉淀成作品、记录和反馈，让家长看得见，也让孩子愿意继续做。</p>
      </div>
      <div class="toon-outcome-grid">
        ${[
          ["作品集", "海报、故事、视频草案和小项目。"],
          ["表达力", "学会描述目标、提出问题、解释选择。"],
          ["迭代力", "从第一版到更好的一版。"],
          ["展示力", "把创作过程讲给别人听。"],
        ].map((item) => `
          <article>
            <strong>${item[0]}</strong>
            <p>${item[1]}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="toon-section toon-console" id="events">
      <div>
        <div class="toon-section-label">活动预告</div>
        <h2>先体验，再决定。</h2>
        <p>开放日、挑战赛、家长沙龙，先看真实课堂。</p>
      </div>
      <div class="toon-browser">
        <div class="toon-browser-bar"><span></span><span></span><span></span><b>xingya.ai/events</b></div>
        <div class="toon-browser-grid">
          <article><span>开放报名</span><strong>AI体验开放日</strong></article>
          <article><span>创意挑战</span><strong>Prompt Battle</strong></article>
          <article><span>家长专场</span><strong>家长AI沙龙</strong></article>
          <article><span>长期开放</span><strong>作品展示</strong></article>
        </div>
      </div>
    </section>

    <section class="toon-section toon-report" id="community">
      <div class="toon-report-panel">
        <div class="toon-section-label">星芽星球</div>
        <h2>成长被记录。</h2>
        <p>作品、点评和阶段成果，沉淀成AI成长档案。</p>
        <a href="#lead">预约体验课</a>
      </div>
      <div class="toon-score-card">
        <img class="toon-score-figure" src="${HERO_ITEMS[2].src}" alt="" aria-hidden="true" />
        <span>优秀作业</span>
        <strong>AI</strong>
        <p>海报、故事、工具和项目展示。</p>
      </div>
    </section>

    <section class="toon-section toon-cta" id="lead">
      <p>星芽AI</p>
      <h2>先预约一节真正的AI课。</h2>
      <a href="#products">查看产品 <span>→</span></a>
    </section>
  `;
}
