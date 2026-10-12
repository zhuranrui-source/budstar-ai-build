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
    label: "AI 项目课",
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
    ${renderAccountMenu()}
    ${renderConsumerAuth()}
    <div class="toast" data-toast hidden></div>
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
          <a href="#community">星芽星球</a>
          <a href="#events">活动</a>
        </nav>
        <div class="toon-nav-actions">
          <button class="toon-account-trigger" type="button" data-account-trigger aria-label="打开个人菜单" aria-expanded="false"><img data-account-avatar src="assets/avatar-placeholder.svg" alt="用户头像" /></button>
        </div>
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

    </div>
  `;
}

function renderAccountMenu() {
  return `
    <aside class="account-popover" data-account-popover hidden>
      <header><img data-menu-avatar src="assets/avatar-placeholder.svg" alt="用户头像" /><div><b data-menu-name>尚未登录</b><small data-menu-role>登录后进入星芽星球</small></div></header>
      <button class="account-primary-action" type="button" data-account-login>登录或注册</button>
      <a href="student.html?role=parent" data-account-enter hidden><span><b>进入星芽星球</b><small>继续查看课程与成长</small></span><strong>→</strong></a>
      <nav class="account-menu-links" data-account-shortcuts hidden>
        <button type="button" data-account-destination="messages"><span><b>消息中心</b><small>作业提醒、批改反馈与活动通知</small></span><strong>←</strong></button>
        <button type="button" data-account-destination="profile"><span><b>账号与隐私</b><small>个人资料、身份与绑定</small></span><strong>←</strong></button>
      </nav>
      <button class="account-switch-role" type="button" data-account-destination="role" data-account-shortcuts hidden><span><b>切换身份</b><small>学生 / 家长</small></span><strong>←</strong></button>
      <button class="account-help" type="button" data-account-destination="help">帮助与反馈 <span>←</span></button>
      <button class="account-logout" type="button" data-account-logout hidden>退出登录</button>
      ${renderAccountFlyouts()}
    </aside>
  `;
}

function renderAccountFlyouts() {
  return `
    <section class="account-flyout" data-account-flyout="messages" hidden><h3>最近提醒</h3><p>只展示需要处理的学习待办和老师反馈。</p><div class="account-notice-list"><a href="student.html?role=student&view=homework"><span>待办</span><div><b>第 8 课作业今天截止</b><small>今天 18:00 前完成预览并提交</small></div></a><a href="student.html?role=parent&view=child"><span>反馈</span><div><b>老师更新了作品点评</b><small>重点关注观点表达与比较思路</small></div></a></div><a class="account-flyout-action" href="student.html?role=parent&view=messages">查看全部消息</a></section>
    <section class="account-flyout" data-account-flyout="profile" hidden><div class="account-profile-summary"><img src="assets/avatar-placeholder.svg" alt="用户头像" /><div><b data-dialog-account-name>周女士</b><small data-dialog-account-role>家长账号</small></div></div><div class="account-privacy-list"><button type="button" data-admin-action="编辑个人资料"><span><b>个人资料</b><small>头像、昵称和身份信息</small></span></button><button type="button" data-admin-action="管理手机号绑定"><span><b>手机号</b><small>138****2026 · 已绑定</small></span></button><button type="button" data-admin-action="查看隐私设置"><span><b>隐私设置</b><small>作品仅对本人及家庭成员可见</small></span></button></div></section>
    <section class="account-flyout" data-account-flyout="role" hidden><h3>选择使用身份</h3><p>身份会影响星芽星球中可查看和操作的内容。</p><div class="account-role-options"><button type="button" data-account-role-choice="student"><b>我是学生</b><small>课程、作业和作品提交</small></button><button type="button" data-account-role-choice="parent"><b>我是家长</b><small>成长反馈、活动和作品预览</small></button></div></section>
    <section class="account-flyout" data-account-flyout="help" hidden><h3>需要帮助？</h3><div class="account-help-list"><button type="button" data-admin-action="查看使用帮助"><b>使用帮助</b><small>登录、身份和作品查看说明</small></button><button type="button" data-admin-action="提交问题反馈"><b>问题反馈</b><small>告诉我们遇到的问题</small></button><button type="button" data-admin-action="联系课程顾问"><b>联系课程顾问</b><small>课程与到店体验咨询</small></button></div></section>
  `;
}

function renderConsumerAuth() {
  return `
    <div class="consumer-auth" data-auth-modal hidden>
      <section class="consumer-auth-card" role="dialog" aria-modal="true" aria-labelledby="consumer-auth-title">
        <button class="consumer-auth-close" type="button" data-close-auth aria-label="关闭登录弹窗">关闭</button>
        <div data-auth-stage>
          <span class="consumer-auth-kicker">星芽账号</span>
          <h2 id="consumer-auth-title">登录或注册</h2>
          <p>登录后再选择学生或家长身份。</p>
          <div class="consumer-auth-tabs" role="tablist" aria-label="登录方式">
            <button class="is-active" type="button" role="tab" data-auth-tab="phone">手机号</button>
            <button type="button" role="tab" data-auth-tab="password">账号密码</button>
          </div>
          <form class="consumer-auth-panel is-active" data-auth-panel="phone" data-consumer-auth-form>
            <label>手机号<input type="tel" value="138 0000 2026" autocomplete="tel" /></label>
            <label>验证码<span class="consumer-code-input"><input value="202626" inputmode="numeric" /><button type="button" data-send-code>获取验证码</button></span></label>
            <button class="consumer-auth-primary" type="submit">继续</button>
          </form>
          <form class="consumer-auth-panel" data-auth-panel="password" data-consumer-auth-form>
            <label>账号<input value="budstar.family" autocomplete="username" /></label>
            <label>密码<input type="password" value="budstar2026" autocomplete="current-password" /></label>
            <button class="consumer-auth-primary" type="submit">登录</button>
          </form>
          <div class="consumer-auth-divider"><span>或使用</span></div>
          <div class="consumer-social-login">
            <button type="button" data-social-auth="微信"><span>微</span>微信登录</button>
            <button type="button" data-social-auth="企业微信"><span>企</span>企业微信登录</button>
          </div>
          <small>首次使用手机号或微信登录时将自动创建账号。</small>
        </div>
        <div class="consumer-role-choice" data-role-choice hidden>
          <span class="consumer-auth-kicker">选择身份</span>
          <h2>这次以谁的身份进入？</h2>
          <p>之后可以在星芽星球内切换。</p>
          <div>
            <a href="student.html?role=student" data-consumer-role="student"><b>我是学生</b><span>课程、作业和AI老师</span></a>
            <a href="student.html?role=parent" data-consumer-role="parent"><b>我是家长</b><span>动态、作品和成长反馈</span></a>
          </div>
        </div>
      </section>
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
        <p>从AI认知，到创意生成，再到项目发布。</p>
      </div>
      <div class="toon-gallery">
        ${[
          ["6-8岁", "星芽启萌", "AI认知、故事表达、创意绘本。", "认识AI能做什么，用图像、声音和故事完成第一件作品。", "培养表达兴趣"],
          ["9-11岁", "星芽探索", "创意生成、提示词、作品迭代。", "围绕一个主题生成素材、筛选方案，并改出更完整的作品。", "形成创作方法"],
          ["12-15岁", "星芽创新", "项目发布、表达展示、问题解决。", "把想法整理成可展示的应用原型、短视频或主题项目。", "完成独立作品"],
        ].map((item) => `
          <article tabindex="0" aria-label="${item[0]} ${item[1]}，悬停或聚焦查看详情">
            <div class="toon-flip-card">
              <div class="toon-flip-face toon-flip-front">
                <span>${item[0]}</span>
                <strong>${item[1]}</strong>
                <p>${item[2]}</p>
              </div>
              <div class="toon-flip-face toon-flip-back">
                <span>课程详情</span>
                <p>${item[3]}</p>
                <strong>${item[4]}</strong>
              </div>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="toon-section toon-thinking">
      <div>
        <div class="toon-section-label">思维培养</div>
        <h2>AI思维培养。</h2>
        <p>AI课堂不是只学工具，而是训练孩子把想法说清楚、把结果看明白、把作品改得更好。</p>
      </div>
      <div class="toon-thinking-grid">
        ${[
          ["提问意识", "把模糊想法变成清楚的问题。"],
          ["判断能力", "比较不同结果，说明为什么选择这一版。"],
          ["表达结构", "讲清目标、过程和作品亮点。"],
          ["迭代习惯", "愿意修改、复盘，再做出更好的一版。"],
        ].map((item) => `
          <article>
            <strong>${item[0]}</strong>
            <p>${item[1]}</p>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="toon-section toon-report" id="community">
      <div class="toon-report-panel">
        <div class="toon-section-label">星芽星球</div>
        <h2>家长看见每一次进步。</h2>
        <p>作品、老师点评和阶段成果，沉淀成孩子的AI成长档案。</p>
        <a href="#login" data-community-entry>进入星球</a>
      </div>
      <div class="toon-score-card">
        <img class="toon-score-figure" src="${HERO_ITEMS[2].src}" alt="" aria-hidden="true" />
        <span>学习成果</span>
        <strong>4项</strong>
        <p>作品集、课堂点评、阶段记录和展示反馈统一进入星芽星球。</p>
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
          <article><span>7月18日 14:00</span><strong>AI体验开放日</strong><small>1课时到店体验</small></article>
          <article><span>7月19日 15:30</span><strong>创意挑战赛</strong><small>孩子创意挑战</small></article>
          <article><span>7月25日 19:30</span><strong>家长AI沙龙</strong><small>家长理解AI教育</small></article>
          <article><span>8月2日 16:00</span><strong>作品展示</strong><small>阶段成果开放看</small></article>
        </div>
      </div>
    </section>

    <section class="toon-section toon-access" id="teachers">
      <div class="toon-access-copy">
        <div class="toon-section-label">师资与校区</div>
        <h2>师资与校区</h2>
        <p>师资雄厚，高学历导师团队，兼顾AI创作、项目引导和家长沟通。</p>
      </div>
      <div class="toon-access-grid">
        ${[
          ["林老师", "AI创作导师", HERO_ITEMS[0].src, "引导想法表达"],
          ["周老师", "项目导师", HERO_ITEMS[3].src, "陪伴项目迭代"],
          ["陈老师", "家长沟通导师", HERO_ITEMS[2].src, "同步课堂反馈"],
          ["许老师", "作品展示导师", HERO_ITEMS[1].src, "训练表达展示"],
        ].map((item) => `
          <article class="toon-teacher-card">
            <div class="toon-avatar"><img src="${item[2]}" alt="" aria-hidden="true" /></div>
            <span>虚拟占位</span>
            <strong>${item[0]}</strong>
            <em>${item[1]}</em>
            <p>${item[3]}</p>
          </article>
        `).join("")}
        <article class="toon-address-card" id="campus">
          <span>到店地址</span>
          <strong>深圳市南山区深云路2号</strong>
          <p>预约到店体验，现场了解课堂环境。</p>
          <a href="#products">预约到店</a>
        </article>
      </div>
    </section>

    <section class="toon-section toon-cta" id="lead">
      <p>星芽AI</p>
      <h2>上一节真正的AI课。</h2>
      <a href="#products">查看产品 <span>→</span></a>
    </section>
  `;
}
