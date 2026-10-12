/* ── Mobile Menu ─────────────────────────────────────────── */
const mobileMenu = document.querySelector("[data-mobile-menu]");
const mobileDrawer = document.querySelector("[data-mobile-drawer]");

mobileMenu?.addEventListener("click", () => {
  mobileDrawer.hidden = !mobileDrawer.hidden;
});
mobileDrawer?.addEventListener("click", (event) => {
  if (event.target.matches("a, button")) {
    mobileDrawer.hidden = true;
  }
});

/* ── Carousel ────────────────────────────────────────────── */
const carouselSlides = Array.from(document.querySelectorAll("[data-carousel-slide]"));
const carouselDots = document.querySelector("[data-carousel-dots]");
let activeCarousel = 0;
let carouselTimer;

if (carouselSlides.length && carouselDots) {
  carouselSlides.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", `切换到第${index + 1}张轮播`);
    dot.addEventListener("click", () => showCarousel(index));
    carouselDots.append(dot);
  });
  showCarousel(0);
}

document.querySelector("[data-carousel-prev]")?.addEventListener("click", () => {
  showCarousel(activeCarousel - 1);
});

document.querySelector("[data-carousel-next]")?.addEventListener("click", () => {
  showCarousel(activeCarousel + 1);
});

function showCarousel(index) {
  if (!carouselSlides.length || !carouselDots) return;
  activeCarousel = (index + carouselSlides.length) % carouselSlides.length;
  carouselSlides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === activeCarousel);
  });
  Array.from(carouselDots.children).forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === activeCarousel);
  });
  window.clearInterval(carouselTimer);
  carouselTimer = window.setInterval(() => showCarousel(activeCarousel + 1), 5200);
}

/* ── Auth Modal ──────────────────────────────────────────── */
const modal = document.querySelector("[data-auth-modal]");
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authPanels = Array.from(document.querySelectorAll("[data-auth-panel]"));

document.querySelectorAll("[data-gated]").forEach((button) => {
  button.addEventListener("click", () => {
    openAuth();
  });
});

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", openAuth);
});

document.querySelector("[data-close-auth]")?.addEventListener("click", closeAuth);

modal?.addEventListener("click", (event) => {
  if (event.target === modal) closeAuth();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal?.hidden) closeAuth();
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setAuthTab(tab.dataset.authTab);
  });
});

document.querySelectorAll("[data-consumer-auth-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    showRoleChoice();
  });
});

document.querySelectorAll("[data-social-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.socialAuth}授权成功`);
    showRoleChoice();
  });
});

document.querySelectorAll("[data-consumer-role]").forEach((link) => {
  link.addEventListener("click", () => {
    const role = link.dataset.consumerRole;
    writeDemoState("budstar-consumer-role", role);
  });
});

function openAuth() {
  if (!modal) return;
  setAuthTab("phone");
  const authStage = modal.querySelector("[data-auth-stage]");
  const roleChoice = modal.querySelector("[data-role-choice]");
  if (authStage) authStage.hidden = false;
  if (roleChoice) roleChoice.hidden = true;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => modal.querySelector("input")?.focus(), 0);
}

document.querySelectorAll("[data-community-entry]").forEach((entry) => {
  entry.addEventListener("click", (event) => {
    event.preventDefault();
    const role = readDemoState("budstar-consumer-role");
    if (role === "student" || role === "parent") {
      window.location.href = `student.html?role=${role}`;
      return;
    }
    openAuth();
  });
});

function closeAuth() {
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function setAuthTab(type) {
  authTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === type);
  });
  authPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.authPanel === type);
  });
}

function showRoleChoice() {
  if (!modal) return;
  const authStage = modal.querySelector("[data-auth-stage]");
  const roleChoice = modal.querySelector("[data-role-choice]");
  if (authStage) authStage.hidden = true;
  if (roleChoice) roleChoice.hidden = false;
  roleChoice?.querySelector("button")?.focus();
}

/* ── Homepage Account Popover ────────────────────────────── */
const accountTrigger = document.querySelector("[data-account-trigger]");
const accountPopover = document.querySelector("[data-account-popover]");

function refreshAccountMenu() {
  if (!accountPopover) return;
  const role = readDemoState("budstar-consumer-role");
  const loggedIn = role === "student" || role === "parent";
  const name = role === "student" ? "李沐辰" : role === "parent" ? "周女士" : "尚未登录";
  const roleLabel = role === "student" ? "学生账号" : role === "parent" ? "家长账号" : "登录后进入星芽星球";
  accountPopover.querySelector("[data-menu-name]").textContent = name;
  accountPopover.querySelector("[data-menu-role]").textContent = roleLabel;
  const login = accountPopover.querySelector("[data-account-login]");
  if (login) login.hidden = loggedIn;
  const enter = accountPopover.querySelector("[data-account-enter]");
  if (enter) {
    enter.hidden = !loggedIn;
    if (loggedIn) enter.href = `student.html?role=${role}`;
  }
  const logout = accountPopover.querySelector("[data-account-logout]");
  if (logout) logout.hidden = !loggedIn;
  accountPopover.querySelectorAll("[data-account-shortcuts]").forEach((section) => section.hidden = !loggedIn);
  document.querySelectorAll("[data-dialog-account-name]").forEach((element) => element.textContent = name);
  document.querySelectorAll("[data-dialog-account-role]").forEach((element) => element.textContent = roleLabel);
}

accountTrigger?.addEventListener("click", () => {
  const open = accountPopover.hidden;
  accountPopover.hidden = !open;
  accountTrigger.setAttribute("aria-expanded", String(open));
  if (open) {
    refreshAccountMenu();
    accountPopover.querySelectorAll("[data-account-flyout]").forEach((panel) => panel.hidden = true);
  }
});

document.querySelector("[data-account-login]")?.addEventListener("click", () => {
  accountPopover.hidden = true;
  accountTrigger?.setAttribute("aria-expanded", "false");
  openAuth();
});

document.querySelector("[data-account-logout]")?.addEventListener("click", () => {
  try { localStorage.removeItem("budstar-consumer-role"); } catch { /* Ignore storage restrictions. */ }
  if (document.body.classList.contains("community-body")) {
    window.location.href = "prototype.html?variant=C";
    return;
  }
  refreshAccountMenu();
  showToast("已退出登录");
});

document.querySelectorAll("[data-account-destination]").forEach((button) => {
  button.addEventListener("click", () => {
    const destination = button.dataset.accountDestination;
    accountPopover.querySelectorAll("[data-account-flyout]").forEach((panel) => panel.hidden = panel.dataset.accountFlyout !== destination);
    accountPopover.classList.add("has-flyout");
  });
});

document.querySelectorAll("[data-close-account-flyout]").forEach((button) => button.addEventListener("click", () => {
  button.closest("[data-account-flyout]").hidden = true;
  accountPopover.classList.remove("has-flyout");
}));

document.querySelectorAll("[data-account-role-choice]").forEach((button) => button.addEventListener("click", () => {
  const role = button.dataset.accountRoleChoice;
  writeDemoState("budstar-consumer-role", role);
  if (document.body.classList.contains("community-body")) applyCommunityRole(role);
  else refreshAccountMenu();
  button.closest("[data-account-flyout]").hidden = true;
  accountPopover.classList.remove("has-flyout");
  showToast(role === "student" ? "已切换为学生身份" : "已切换为家长身份");
}));

document.addEventListener("click", (event) => {
  if (!accountPopover || accountPopover.hidden) return;
  if (!accountPopover.contains(event.target) && !accountTrigger?.contains(event.target)) {
    accountPopover.hidden = true;
    accountPopover.classList.remove("has-flyout");
    accountPopover.querySelectorAll("[data-account-flyout]").forEach((panel) => panel.hidden = true);
    accountTrigger?.setAttribute("aria-expanded", "false");
  }
});

refreshAccountMenu();

if (document.body.classList.contains("prototype-body") && new URLSearchParams(window.location.search).get("auth") === "required") {
  window.setTimeout(() => openAuth(), 0);
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

const toast = document.querySelector("[data-toast]");

/* ── Admin Tabs ──────────────────────────────────────────── */
const adminTabs = Array.from(document.querySelectorAll("[data-admin-tab]"));
const adminPanels = Array.from(document.querySelectorAll("[data-admin-panel]"));

adminTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.adminTab;
    adminTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    adminPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.adminPanel === target);
      if (panel.dataset.adminPanel === target) animatePortalPanel(panel);
    });
  });
});

function showAdminPanel(target) {
  document.querySelector(`[data-admin-tab="${target}"]`)?.click();
}

document.querySelectorAll("[data-admin-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    showAdminPanel(button.dataset.adminJump);
    const section = button.dataset.adminSectionJump;
    if (section) window.setTimeout(() => document.querySelector(`[data-admin-section="${section}"]`)?.click(), 0);
  });
});

document.querySelectorAll("[data-admin-section]").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = button.closest("[data-admin-panel]");
    const target = button.dataset.adminSection;
    if (!panel) return;
    panel.querySelectorAll("[data-admin-section]").forEach((item) => item.classList.toggle("is-active", item === button));
    panel.querySelectorAll("[data-admin-subpanel]").forEach((subpanel) => subpanel.classList.toggle("is-active", subpanel.dataset.adminSubpanel === target));
  });
});

document.querySelectorAll("[data-admin-section-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = document.querySelector("[data-admin-panel].is-active");
    panel?.querySelector(`[data-admin-section="${button.dataset.adminSectionJump}"]`)?.click();
  });
});

document.querySelectorAll("[data-task-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.taskFilter;
    document.querySelectorAll("[data-task-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-task-type]").forEach((task) => {
      task.hidden = filter !== "all" && task.dataset.taskType !== filter;
    });
  });
});

document.querySelectorAll("[data-admin-tab-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.adminTabJump;
    document.querySelector(`[data-admin-tab="${target}"]`)?.click();
  });
});

document.querySelectorAll("[data-admin-action]").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.adminAction}：已生成演示反馈`);
    if (button.hasAttribute("data-close-on-action")) closePortalDialog(button.closest("[data-dialog]"));
  });
});

/* ── Operations Dashboard ───────────────────────────────── */
const analyticsRanges = {
  week: { students: "24", submit: "91%", feedback: "4.8h", visit: "72%", notes: ["7天活跃学员", "32份应提交作品", "目标 12 小时内", "11条新增线索"] },
  month: { students: "31", submit: "86%", feedback: "6.2h", visit: "68%", notes: ["较上月 +12%", "24份本周提交", "目标 12 小时内", "17条新增线索"] },
  term: { students: "56", submit: "84%", feedback: "7.1h", visit: "64%", notes: ["含体验课学员", "124份作品沉淀", "较上学期快 1.4h", "42条累计咨询"] },
};

document.querySelectorAll("[data-range]").forEach((button) => {
  button.addEventListener("click", () => {
    const data = analyticsRanges[button.dataset.range];
    if (!data) return;
    document.querySelectorAll("[data-range]").forEach((item) => item.classList.toggle("is-active", item === button));
    ["students", "submit", "feedback", "visit"].forEach((key, index) => {
      const value = document.querySelector(`[data-metric="${key}"]`);
      const note = document.querySelector(`[data-metric-note="${key}"]`);
      if (value) value.textContent = data[key];
      if (note) note.textContent = data.notes[index];
    });
    showToast(`数据周期已切换：${button.textContent}`);
  });
});

const databaseSamples = {
  students: { count: "31 条记录", columns: ["id", "name", "campus_id", "class_id", "family_bound", "updated_at"], rows: [["stu_4829", "李沐辰", "sz_nanshan", "class_a", "true", "今天 10:24"], ["stu_7316", "周语桐", "sz_nanshan", "class_b", "true", "昨天 18:42"], ["stu_9031", "沈小北", "sz_nanshan", "trial_0718", "false", "7月12日 09:18"]] },
  classes: { count: "4 条记录", columns: ["id", "name", "course_id", "teacher_id", "status", "updated_at"], rows: [["class_a", "星芽探索 A", "seed_01", "tea_lin", "active", "今天 09:40"], ["class_b", "星芽创新 B", "seed_01", "tea_zhou", "active", "昨天 17:12"], ["trial_0718", "周六体验班", "trial_99", "tea_chen", "open", "今天 11:06"]] },
  submissions: { count: "124 条记录", columns: ["id", "student_id", "lesson_id", "type", "status", "submitted_at"], rows: [["sub_1288", "stu_4829", "lesson_08", "image", "pending", "今天 10:18"], ["sub_1287", "stu_7316", "lesson_12", "link", "reviewed", "昨天 20:04"], ["sub_1286", "stu_4829", "lesson_07", "text", "published", "7月11日 18:22"]] },
  feedback: { count: "98 条记录", columns: ["id", "submission_id", "teacher_id", "ai_status", "publish_status", "updated_at"], rows: [["fb_088", "sub_1288", "tea_lin", "ready", "draft", "今天 10:26"], ["fb_087", "sub_1287", "tea_zhou", "ready", "published", "昨天 21:12"], ["fb_086", "sub_1286", "tea_lin", "ready", "published", "7月11日 19:05"]] },
  reports: { count: "22 条记录", columns: ["id", "student_id", "milestone", "score_status", "status", "updated_at"], rows: [["rep_022", "stu_4829", "lesson_08", "ready", "review", "今天 08:42"], ["rep_021", "stu_7316", "lesson_12", "ready", "published", "昨天 16:30"], ["rep_020", "stu_4829", "lesson_04", "ready", "published", "6月18日 14:10"]] },
  leads: { count: "47 条记录", columns: ["id", "parent_name", "product", "source", "status", "updated_at"], rows: [["lead_047", "沈小北家长", "trial_99", "website", "new", "今天 11:18"], ["lead_046", "陈予安家长", "term", "planet", "contacted", "今天 09:32"], ["lead_045", "赵一诺家长", "camp", "event", "visited", "昨天 18:15"]] },
  model_runs: { count: "1,842 条记录", columns: ["id", "task", "provider", "model", "latency", "status"], rows: [["run_1842", "feedback_draft", "volcengine", "doubao-pro", "1.4s", "success"], ["run_1841", "student_coach", "aliyun", "qwen-plus", "0.9s", "success"], ["run_1840", "score_report", "aliyun", "qwen-max", "3.2s", "retried"]] },
};

function renderDatabaseTable(name) {
  const sample = databaseSamples[name];
  if (!sample) return;
  const title = document.querySelector("[data-db-title]");
  const description = document.querySelector("[data-db-description]");
  const table = document.querySelector(".portal-db-table");
  if (title) title.textContent = name;
  if (description) description.textContent = `${name} · ${sample.count}`;
  if (table) {
    table.querySelector("thead").innerHTML = `<tr>${sample.columns.map((column) => `<th>${column}</th>`).join("")}</tr>`;
    table.querySelector("tbody").innerHTML = sample.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  }
}

document.querySelectorAll("[data-db-table]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-db-table]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderDatabaseTable(button.dataset.dbTable);
  });
});

document.querySelector("[data-db-search]")?.addEventListener("input", (event) => {
  const query = event.target.value.trim().toLowerCase();
  document.querySelectorAll("[data-db-table]").forEach((button) => {
    button.hidden = !button.dataset.dbTable.includes(query);
  });
});

document.querySelectorAll("[data-db-schema] button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-db-schema] button").forEach((item) => item.classList.toggle("is-active", item === button));
    showToast(`${button.textContent}视图已切换（Demo）`);
  });
});

document.querySelector("[data-db-sync]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  button.textContent = "同步中…";
  window.setTimeout(() => {
    button.textContent = "刷新同步";
    const status = document.querySelector("[data-db-sync-status]");
    if (status) status.textContent = "最后同步：刚刚";
    showToast("数据库镜像已同步");
  }, 700);
});

document.querySelector("[data-demo-query]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  button.textContent = "运行中…";
  window.setTimeout(() => {
    button.textContent = "运行查询";
    const result = document.querySelector("[data-query-result]");
    if (result) result.textContent = "查询成功 · 返回 20 行 · 38ms";
  }, 620);
});

document.querySelectorAll("[data-route-row]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-route-row]").forEach((item) => item.classList.toggle("is-selected", item === button));
}));

document.querySelectorAll("[data-policy-toggle]").forEach((button) => button.addEventListener("click", () => {
  button.classList.toggle("is-on");
  showToast(`${button.querySelector("span")?.textContent}：${button.classList.contains("is-on") ? "已启用" : "已停用"}`);
}));

document.querySelectorAll("[data-provider-toggle]").forEach((button) => button.addEventListener("click", () => {
  const dot = button.querySelector("i");
  const status = button.querySelector("em");
  dot?.classList.toggle("is-online");
  if (status) status.textContent = dot?.classList.contains("is-online") ? "启用" : "停用";
}));

document.querySelector("[data-gateway-run]")?.addEventListener("click", (event) => {
  event.preventDefault();
  const button = event.currentTarget;
  button.textContent = "测试中…";
  const result = document.querySelector("[data-gateway-result]");
  if (result) result.hidden = true;
  window.setTimeout(() => {
    button.textContent = "再次测试";
    if (result) result.hidden = false;
  }, 850);
});

/* ── Dedicated Auth Demo ────────────────────────────────── */
const dedicatedAuthModes = Array.from(document.querySelectorAll("[data-auth-mode]"));
const dedicatedAuthForms = Array.from(document.querySelectorAll("[data-auth-form]"));

dedicatedAuthModes.forEach((button) => button.addEventListener("click", () => {
  dedicatedAuthModes.forEach((item) => item.classList.toggle("is-active", item === button));
  dedicatedAuthForms.forEach((form) => form.classList.toggle("is-active", form.dataset.authForm === button.dataset.authMode));
  const heading = document.querySelector("[data-auth-heading]");
  if (heading) heading.textContent = button.dataset.authMode === "login" ? "登录星芽AI" : "创建星芽账号";
}));

document.querySelectorAll("[data-auth-role]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-auth-role]").forEach((item) => item.classList.toggle("is-active", item === button));
  const isStaff = button.dataset.authRole === "staff";
  const password = document.querySelector("[data-login-password]");
  const code = document.querySelector("[data-login-code]");
  if (password) password.hidden = !isStaff;
  if (code) code.hidden = isStaff;
  const submit = document.querySelector("[data-auth-submit]");
  if (submit) submit.textContent = isStaff ? "进入交付后台" : button.dataset.authRole === "student" ? "进入学生星球" : "进入家长空间";
}));

document.querySelectorAll("[data-send-code]").forEach((button) => button.addEventListener("click", () => {
  let seconds = 5;
  button.disabled = true;
  button.textContent = `${seconds}s`;
  const timer = window.setInterval(() => {
    seconds -= 1;
    button.textContent = seconds > 0 ? `${seconds}s` : "重新获取";
    if (seconds <= 0) { window.clearInterval(timer); button.disabled = false; }
  }, 1000);
  showToast("演示验证码：202626");
}));

document.querySelector("[data-password-toggle]")?.addEventListener("click", (event) => {
  const input = document.querySelector("[data-password]");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  event.currentTarget.textContent = input.type === "password" ? "显示" : "隐藏";
});

document.querySelector("[data-register-role]")?.addEventListener("change", (event) => {
  const label = document.querySelector("[data-registration-code]");
  if (!label) return;
  const role = event.target.value;
  label.firstChild.textContent = role === "student" ? "班级码（可稍后填写）" : role === "parent" ? "家庭查看码（可稍后填写）" : "员工邀请码（由校区管理员提供）";
});

dedicatedAuthForms.forEach((form) => form.addEventListener("submit", (event) => {
  event.preventDefault();
  const activeRole = document.querySelector("[data-auth-role].is-active")?.dataset.authRole || "parent";
  const isRegister = form.dataset.authForm === "register";
  const target = activeRole === "staff" || isRegister && form.querySelector("[data-register-role]")?.value === "staff" ? "admin.html" : "student.html";
  showToast(isRegister ? "账号创建成功，正在进入 Demo" : "登录成功，正在进入 Demo");
  window.setTimeout(() => { window.location.href = target; }, 520);
}));

/* ── Scroll-based Fade-in (IntersectionObserver) ─────────── */
const fadeObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-visible");
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: "0px 0px -60px 0px" });

document.querySelectorAll(".fade-in").forEach(el => fadeObserver.observe(el));

/* ── Student Tabs ────────────────────────────────────────── */
const studentTabs = Array.from(document.querySelectorAll("[data-student-tab]"));
const studentPanels = Array.from(document.querySelectorAll("[data-student-panel]"));
let activeCommunityRole = "parent";

function applyCommunityRole(role) {
  if (!document.body.classList.contains("community-body")) return;
  activeCommunityRole = role === "student" ? "student" : "parent";
  writeDemoState("budstar-consumer-role", activeCommunityRole);
  document.body.dataset.communityRole = activeCommunityRole;
  document.title = activeCommunityRole === "student" ? "星芽星球 | 学生空间" : "星芽星球 | 家长社区";

  const learning = document.querySelector('[data-role-nav="learning"]');
  const work = document.querySelector('[data-role-nav="work"]');
  if (learning) {
    learning.dataset.studentTab = activeCommunityRole === "student" ? "courses" : "child";
    learning.textContent = activeCommunityRole === "student" ? "课程" : "孩子";
  }
  if (work) {
    work.dataset.studentTab = activeCommunityRole === "student" ? "homework" : "events";
    work.textContent = activeCommunityRole === "student" ? "作业" : "活动";
  }

  document.querySelectorAll("[data-student-only]").forEach((panel) => panel.hidden = activeCommunityRole !== "student");
  document.querySelectorAll("[data-parent-only]").forEach((element) => {
    if (activeCommunityRole === "student") element.hidden = true;
    else if (!element.matches("[data-message-view]")) element.hidden = false;
  });
  ["child", "events"].forEach((key) => {
    const panel = document.querySelector(`[data-student-panel="${key}"]`);
    if (panel) panel.hidden = activeCommunityRole === "student";
  });
  const rolePill = document.querySelector(".community-role-pill");
  if (rolePill) rolePill.textContent = activeCommunityRole === "student" ? "学生模式" : "家长模式";
  const brandSubtitle = document.querySelector(".community-brand small");
  if (brandSubtitle) brandSubtitle.textContent = activeCommunityRole === "student" ? "学生空间" : "家长社区";
  const profileAvatar = document.querySelector("[data-profile-avatar]");
  const profileName = document.querySelector("[data-profile-name]");
  const profileSummary = document.querySelector("[data-profile-summary]");
  if (profileAvatar) profileAvatar.textContent = activeCommunityRole === "student" ? "沐" : "周";
  if (profileName) profileName.textContent = activeCommunityRole === "student" ? "李沐辰" : "周女士";
  if (profileSummary) profileSummary.textContent = activeCommunityRole === "student" ? "AI星芽种子实验班　学生账号" : "已绑定 1 个孩子";
  const parentProfile = document.querySelector("[data-parent-profile]");
  const studentProfile = document.querySelector("[data-student-profile]");
  if (parentProfile) parentProfile.hidden = activeCommunityRole === "student";
  if (studentProfile) studentProfile.hidden = activeCommunityRole !== "student";
  const planetTitle = document.querySelector("[data-planet-title]");
  const planetCopy = document.querySelector("[data-planet-copy]");
  if (planetTitle) planetTitle.textContent = activeCommunityRole === "student" ? "学习星球" : "星球动态";
  if (planetCopy) planetCopy.textContent = activeCommunityRole === "student" ? "老师任务、学习动态和同学作品。" : "老师动态、作品和活动消息。";
  refreshAccountMenu();
  showCommunityPanel("planet");
}

function showCommunityPanel(target) {
  studentTabs.forEach((item) => item.classList.toggle("is-active", item.dataset.studentTab === target));
  studentPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.studentPanel === target);
    if (panel.dataset.studentPanel === target) animatePortalPanel(panel);
  });
}

studentTabs.forEach((tab) => {
  tab.addEventListener("click", () => showCommunityPanel(tab.dataset.studentTab));
});

document.querySelectorAll("[data-student-tab-jump]").forEach((button) => {
  button.addEventListener("click", () => {
    showCommunityPanel(button.dataset.studentTabJump);
  });
});

document.querySelectorAll("[data-community-role]").forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.communityRole;
    applyCommunityRole(role);
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);
    window.history.replaceState({}, "", url);
    closePortalDialog(button.closest("[data-dialog]"));
    showToast(role === "student" ? "已切换到学生模式" : "已切换到家长模式");
  });
});

document.querySelector("[data-consumer-logout]")?.addEventListener("click", () => {
  try { localStorage.removeItem("budstar-consumer-role"); } catch { /* Ignore storage restrictions. */ }
  window.location.href = "prototype.html?variant=C";
});

if (document.body.classList.contains("community-body")) {
  const authenticatedRole = readDemoState("budstar-consumer-role");
  if (authenticatedRole !== "student" && authenticatedRole !== "parent") {
    window.location.replace("prototype.html?variant=C&auth=required");
  } else {
    applyCommunityRole(authenticatedRole);
    const requestedView = new URLSearchParams(window.location.search).get("view");
    if (requestedView) showCommunityPanel(requestedView);
  }
}

document.querySelectorAll("[data-feed-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.feedFilter;
    document.querySelectorAll("[data-feed-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
    let visible = 0;
    document.querySelectorAll("[data-feed-type]").forEach((post) => {
      const show = filter === "all" || post.dataset.feedType === filter;
      post.hidden = !show;
      if (show) visible += 1;
    });
    const empty = document.querySelector("[data-feed-empty]");
    if (empty) empty.hidden = visible > 0;
  });
});

document.querySelectorAll("[data-like-button]").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("is-liked");
    const count = button.querySelector("b");
    if (count) count.textContent = String(Number(count.textContent) + (button.classList.contains("is-liked") ? 1 : -1));
  });
});

document.querySelector("[data-comment-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector("input");
  const comments = event.currentTarget.previousElementSibling;
  if (!input?.value.trim() || !comments) return;
  const item = document.createElement("article");
  const author = document.createElement("b");
  const message = document.createElement("p");
  author.textContent = "周女士";
  message.textContent = input.value.trim();
  item.append(author, message);
  comments.append(item);
  input.value = "";
  showToast("留言已发布");
});

document.querySelector("[data-booking-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  closePortalDialog(event.currentTarget.closest("[data-dialog]"));
  showToast("活动登记成功");
});

document.querySelectorAll("[data-demo-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    closePortalDialog(form.closest("[data-dialog]"));
    showToast(form.dataset.demoForm);
  });
});

document.querySelectorAll("[data-publish-feedback]").forEach((button) => {
  button.addEventListener("click", () => {
    const editor = button.closest("[data-dialog], .ops-review-editor")?.querySelector("textarea") || document.querySelector("[data-feedback-editor]");
    const reviewTitle = document.querySelector("[data-review-title]")?.textContent || "城市噪音观察海报";
    const reviewStudent = document.querySelector("[data-review-student]")?.textContent?.split("　")[0] || "李沐辰";
    writeDemoState("budstar-published-feedback", {
      title: reviewTitle,
      student: reviewStudent,
      text: editor?.value.trim() || "观察具体，下一步可以让标题更直接。",
      at: "刚刚",
    });
    const reviewItem = document.querySelector("[data-review-item].is-active") || document.querySelector('[data-review-item="noise"]');
    if (reviewItem) {
      reviewItem.querySelector("time").textContent = "已发布";
      reviewItem.classList.add("is-published");
    }
    closePortalDialog(button.closest("[data-dialog]"));
    showToast("点评已发布，家长端可以查看");
  });
});

const roleAccess = {
  teacher: ["desk", "teaching", "community"],
  service: ["desk", "teaching", "community", "family"],
  admin: ["desk", "teaching", "community", "family", "system"],
};

function applyDemoRole(role) {
  const labels = { teacher: ["林老师", "老师"], service: ["陈老师", "教务"], admin: ["朱老师", "校区管理员"] };
  const value = labels[role] || labels.admin;
  const allowed = roleAccess[role] || roleAccess.admin;
  const user = document.querySelector(".ops-user>button");
  if (user) {
    user.querySelector("span").textContent = value[0];
    user.querySelector("small").textContent = value[1];
  }
  adminTabs.forEach((tab) => {
    tab.hidden = !allowed.includes(tab.dataset.adminTab);
  });
  const active = document.querySelector("[data-admin-tab].is-active");
  if (!active || active.hidden) showAdminPanel("desk");
  document.body.dataset.currentRole = role;
}

document.querySelectorAll("[data-role-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    const role = button.dataset.roleDemo;
    applyDemoRole(role);
    closePortalDialog(button.closest("[data-dialog]"));
    showToast(`已切换为${document.querySelector(".ops-user small")?.textContent || "演示角色"}`);
  });
});

if (document.body.classList.contains("ops-body")) applyDemoRole("admin");

/* ── Student Actions ─────────────────────────────────────── */
document.querySelectorAll("[data-student-action]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.studentAction;
    if (action === "logout") {
      window.location.href = "index.html";
      return;
    }
    showToast(`${action}：操作成功`);
  });
});

/* ── Portal Dialogs ─────────────────────────────────────── */
const portalDialogs = Array.from(document.querySelectorAll("[data-dialog]"));
let dialogReturnFocus = null;

portalDialogs.forEach((dialog, index) => {
  const heading = dialog.querySelector("h2");
  if (heading && !heading.id) heading.id = `dialog-title-${index + 1}`;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  if (heading) dialog.setAttribute("aria-labelledby", heading.id);
});

function openPortalDialog(name) {
  const dialog = portalDialogs.find((item) => item.dataset.dialog === name);
  if (!dialog) return;
  if (!document.activeElement?.closest?.("[data-dialog]")) dialogReturnFocus = document.activeElement;
  portalDialogs.forEach((item) => {
    if (item !== dialog) item.hidden = true;
  });
  dialog.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => dialog.querySelector("[data-close-dialog], input, select, textarea, button")?.focus(), 0);
  if (window.gsap && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.gsap.fromTo(dialog.querySelector(".portal-dialog-panel"), { y: 18, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.36, ease: "power3.out" });
  }
}

function closePortalDialog(dialog) {
  if (!dialog) return;
  dialog.hidden = true;
  const hasOpenDialog = portalDialogs.some((item) => !item.hidden);
  if (!hasOpenDialog && modal?.hidden !== false) {
    document.body.style.overflow = "";
  }
  if (dialogReturnFocus instanceof HTMLElement) dialogReturnFocus.focus();
}

document.querySelectorAll("[data-open-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.eventTitle) {
      const dialog = document.querySelector('[data-dialog="event-booking"]');
      if (dialog) {
        dialog.querySelector("[data-event-name]").textContent = button.dataset.eventTitle;
        dialog.querySelector("[data-event-copy]").textContent = `${button.dataset.eventTime}，${button.dataset.eventDetail}`;
      }
    }
    if (button.dataset.workTitle) {
      const dialog = document.querySelector('[data-dialog="work-story"]');
      if (dialog) {
        dialog.querySelector("[data-work-title]").textContent = button.dataset.workTitle;
        const image = dialog.querySelector("[data-work-image]");
        image.src = button.dataset.workImage;
        image.alt = button.dataset.workTitle;
        dialog.querySelector("[data-work-lesson]").textContent = button.dataset.workLesson;
        dialog.querySelector("[data-work-thought]").textContent = button.dataset.workThought;
        dialog.querySelector("[data-work-feedback]").textContent = button.dataset.workFeedback;
      }
    }
    openPortalDialog(button.dataset.openDialog);
  });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    closePortalDialog(button.closest("[data-dialog]"));
  });
});

portalDialogs.forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closePortalDialog(dialog);
  });
});

document.addEventListener("keydown", (event) => {
  const openDialog = portalDialogs.find((dialog) => !dialog.hidden);
  if (!openDialog) return;
  if (event.key === "Escape") {
    closePortalDialog(openDialog);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(openDialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function readDemoState(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

function writeDemoState(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Demo still works without persistence. */ }
}

function appendMessage(container, text, className = "") {
  if (!container || !text || Array.from(container.children).some((item) => item.textContent === text)) return;
  const bubble = document.createElement("p");
  if (className) bubble.className = className;
  bubble.textContent = text;
  container.append(bubble);
}

function renderHomeworkSubmission(submission) {
  if (!submission) return;
  const state = document.querySelector("[data-homework-state]");
  if (state) {
    state.classList.add("is-submitted");
    state.querySelector("h3").textContent = "已提交，等待老师确认";
    state.querySelector("p").textContent = `${submission.title}　${submission.fileName || "作品链接"}`;
    const action = state.querySelector("button");
    action.textContent = "更新作业";
  }

  const parentCard = document.querySelector("[data-parent-submission]");
  if (parentCard) {
    parentCard.hidden = false;
    parentCard.dataset.workTitle = submission.title;
    parentCard.dataset.workImage = "assets/community-noise-poster.jpg";
    parentCard.dataset.workLesson = "第8课";
    parentCard.dataset.workThought = submission.description;
    const published = readDemoState("budstar-published-feedback");
    parentCard.dataset.workFeedback = published?.title === submission.title ? published.text : "老师正在使用AI辅助批改，确认后会同步反馈。";
    parentCard.querySelector("[data-parent-submission-title]").textContent = submission.title;
    parentCard.querySelector("[data-parent-submission-meta]").textContent = published?.title === submission.title ? "老师已批改" : "等待老师批改";
  }

  const queue = document.querySelector(".ops-review-queue");
  if (queue && !queue.querySelector('[data-review-item="uploaded"]')) {
    const count = queue.querySelector("header span");
    if (count) count.textContent = "7份";
    const navCount = document.querySelector('[data-admin-section="reviews"] span');
    if (navCount) navCount.textContent = "7";
    const item = document.createElement("button");
    item.type = "button";
    item.dataset.reviewItem = "uploaded";
    const image = document.createElement("img");
    image.src = "assets/community-noise-poster.jpg";
    image.alt = submission.title;
    const copy = document.createElement("span");
    const title = document.createElement("b");
    const meta = document.createElement("small");
    title.textContent = submission.title;
    meta.textContent = "李沐辰　第8课新提交";
    copy.append(title, meta);
    const time = document.createElement("time");
    time.textContent = submission.at;
    item.append(image, copy, time);
    item.addEventListener("click", () => {
      queue.querySelectorAll("[data-review-item]").forEach((button) => button.classList.toggle("is-active", button === item));
      document.querySelector("[data-review-title]").textContent = submission.title;
      document.querySelector("[data-review-student]").textContent = "李沐辰　AI星芽种子实验班";
      document.querySelector("[data-review-description]").textContent = submission.description;
      document.querySelector("[data-feedback-editor]").value = "";
      const annotations = document.querySelector("[data-ai-annotations]");
      if (annotations) annotations.hidden = true;
    });
    queue.querySelector("header")?.insertAdjacentElement("afterend", item);
  }
}

document.querySelector("[data-homework-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submission = {
    title: form.elements.title.value.trim(),
    link: form.elements.link.value.trim(),
    description: form.elements.description.value.trim(),
    fileName: form.elements.file.files[0]?.name || "作品链接",
    at: "刚刚",
  };
  writeDemoState("budstar-homework-submission", submission);
  renderHomeworkSubmission(submission);
  closePortalDialog(form.closest("[data-dialog]"));
  showToast("作业已提交，老师和家长可以查看");
});

document.querySelector("[data-homework-preview]")?.addEventListener("click", (event) => {
  const form = event.currentTarget.closest("form");
  const panel = form?.querySelector("[data-homework-preview-panel]");
  if (!form || !panel) return;
  panel.querySelector("[data-preview-title]").textContent = form.elements.title.value.trim() || "未填写标题";
  const link = panel.querySelector("[data-preview-link]");
  link.href = form.elements.link.value.trim() || "#";
  link.textContent = form.elements.file.files[0]?.name || form.elements.link.value.trim() || "未添加作品";
  panel.querySelector("[data-preview-description]").textContent = form.elements.description.value.trim() || "未填写创作说明";
  panel.hidden = false;
});

renderHomeworkSubmission(readDemoState("budstar-homework-submission"));

document.querySelector("[data-ai-review]")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const editor = document.querySelector("[data-feedback-editor]");
  const title = document.querySelector("[data-review-title]")?.textContent || "这份作品";
  button.textContent = "AI分析中";
  window.setTimeout(() => {
    if (editor) editor.value = `${title}已经表达了一个明确观点，也能说明素材选择。建议下一版补充一次方案比较，并把标题改得更直接。`;
    const annotations = document.querySelector("[data-ai-annotations]");
    if (annotations) annotations.hidden = false;
    button.textContent = "重新生成标注";
    showToast("AI批改草稿已生成，请老师确认后发布");
  }, 520);
});

const savedParentMessage = readDemoState("budstar-parent-message");
appendMessage(document.querySelector("[data-staff-message-bubbles]"), savedParentMessage?.text);
if (savedParentMessage?.text) {
  const preview = document.querySelector("[data-parent-message-preview]");
  if (preview) preview.textContent = savedParentMessage.text;
}

document.querySelectorAll("[data-parent-thread]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-parent-thread]").forEach((item) => item.classList.toggle("is-active", item === button));
    document.querySelectorAll("[data-parent-conversation]").forEach((view) => view.hidden = view.dataset.parentConversation !== button.dataset.parentThread);
  });
});

document.querySelector("[data-staff-message-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = event.currentTarget.querySelector("input");
  const text = input?.value.trim();
  if (!text) return;
  appendMessage(event.currentTarget.parentElement.querySelector("[data-staff-message-bubbles]"), text, "is-parent");
  writeDemoState("budstar-staff-reply", { text, at: "刚刚" });
  input.value = "";
  showToast("回复已发送给家长");
});

const savedFeedback = readDemoState("budstar-published-feedback");
if (savedFeedback && document.querySelector("[data-feed-list]")) {
  const post = document.createElement("article");
  post.className = "community-post community-post-compact";
  post.dataset.feedType = "class";
  const author = document.createElement("header");
  author.className = "community-post-author";
  const avatar = document.createElement("span");
  avatar.className = "community-avatar is-teacher";
  avatar.textContent = "林";
  const meta = document.createElement("div");
  const name = document.createElement("b");
  const time = document.createElement("small");
  name.textContent = "林老师发布了新点评";
  time.textContent = `${savedFeedback.student}　${savedFeedback.at}`;
  meta.append(name, time);
  author.append(avatar, meta);
  const copy = document.createElement("div");
  copy.className = "community-post-copy";
  const title = document.createElement("h2");
  const feedback = document.createElement("p");
  title.textContent = savedFeedback.title;
  feedback.textContent = savedFeedback.text;
  copy.append(title, feedback);
  const action = document.createElement("button");
  action.className = "community-link-button";
  action.type = "button";
  action.textContent = "查看孩子成长";
  action.addEventListener("click", () => document.querySelector('[data-student-tab="child"]')?.click());
  post.append(author, copy, action);
  document.querySelector("[data-feed-list]").prepend(post);
}

document.querySelector("[data-report-generate]")?.addEventListener("click", (event) => {
  const report = { student: "李沐辰", lesson: "第8课", at: "刚刚" };
  writeDemoState("budstar-published-report", report);
  const row = document.querySelector('[data-report-row="li"]');
  if (row) {
    const status = row.querySelector("[data-report-status]");
    const button = row.querySelector("[data-report-open]");
    status.textContent = "已发布";
    status.classList.add("is-success");
    button.textContent = "查看报告";
  }
  closePortalDialog(event.currentTarget.closest("[data-dialog]"));
  showToast("成长报告已发布给家长");
});

const savedReport = readDemoState("budstar-published-report");
if (savedReport) {
  const row = document.querySelector('[data-report-row="li"]');
  if (row) {
    const status = row.querySelector("[data-report-status]");
    const button = row.querySelector("[data-report-open]");
    status.textContent = "已发布";
    status.classList.add("is-success");
    button.textContent = "查看报告";
  }
  const note = document.querySelector("[data-report-published-note]");
  if (note) note.hidden = false;
}

function renderPublishedStory(story) {
  if (!story) return;
  const feed = document.querySelector("[data-feed-list]");
  if (feed && !feed.querySelector("[data-shared-story]")) {
    const post = document.createElement("article");
    post.className = "community-post community-post-compact";
    post.dataset.feedType = "community";
    post.dataset.sharedStory = "true";
    const author = document.createElement("header");
    author.className = "community-post-author";
    const avatar = document.createElement("span");
    avatar.className = "community-avatar is-campus";
    avatar.textContent = "星";
    const meta = document.createElement("div");
    const name = document.createElement("b");
    const time = document.createElement("small");
    name.textContent = "星芽AI";
    time.textContent = `星芽动态　${story.at}`;
    meta.append(name, time);
    author.append(avatar, meta);
    const copy = document.createElement("div");
    copy.className = "community-post-copy";
    const title = document.createElement("h2");
    title.textContent = "老师发布了新动态";
    const content = document.createElement("p");
    content.textContent = story.content;
    copy.append(title, content);
    post.append(author, copy);
    feed.prepend(post);
  }
  const list = document.querySelector(".ops-content-list");
  if (list && !list.querySelector("[data-shared-story]")) {
    const item = document.createElement("article");
    item.dataset.sharedStory = "true";
    const cover = document.createElement("div");
    cover.className = "ops-text-cover";
    cover.textContent = "动态";
    const copy = document.createElement("div");
    const title = document.createElement("b");
    const meta = document.createElement("small");
    title.textContent = story.content;
    meta.textContent = `全部成员　${story.at}`;
    copy.append(title, meta);
    const status = document.createElement("span");
    status.className = "ops-status is-success";
    status.textContent = "已发布";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "已同步";
    item.append(cover, copy, status, edit);
    list.prepend(item);
  }
}

document.querySelector("[data-story-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const story = {
    scope: event.currentTarget.elements.scope.value,
    content: event.currentTarget.elements.content.value.trim(),
    at: "刚刚",
  };
  if (!story.content) return;
  writeDemoState("budstar-published-story", story);
  renderPublishedStory(story);
  closePortalDialog(event.currentTarget.closest("[data-dialog]"));
  showToast("动态已发布并同步到家长端");
});

renderPublishedStory(readDemoState("budstar-published-story"));

document.querySelectorAll("[data-chat-send]").forEach((button) => {
  button.addEventListener("click", () => {
    const composer = button.closest(".portal-chat-composer");
    const input = composer?.querySelector("input");
    const windowEl = button.closest(".portal-chat-window");
    if (!input || !windowEl) return;
    const userBubble = document.createElement("div");
    userBubble.className = "portal-chat-bubble is-user";
    userBubble.textContent = input.value || "我想继续优化作品";
    const aiBubble = document.createElement("div");
    aiBubble.className = "portal-chat-bubble is-ai";
    aiBubble.textContent = "可以。先把标题写成一个具体观察，再补一句你希望大家改变什么。";
    windowEl.insertBefore(userBubble, composer);
    windowEl.insertBefore(aiBubble, composer);
    showToast("星芽AI老师已给出拆解建议");
  });
});

function animatePortalPanel(panel) {
  if (!window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.gsap.fromTo(panel.querySelectorAll(".motion-card"), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.04, ease: "power2.out" });
  window.ScrollTrigger?.refresh();
}

function initPortalMotion() {
  if (!window.gsap || !window.ScrollTrigger || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.gsap.registerPlugin(window.ScrollTrigger);

  window.gsap.fromTo(".portal-hero.motion-card", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" });

  window.gsap.utils.toArray(".portal-panel.is-active .motion-card, .portal-hero.motion-card").forEach((card) => {
    if (card.classList.contains("portal-hero")) return;
    window.gsap.fromTo(card, { y: 34, scale: 0.98, opacity: 0.35 }, {
      y: 0,
      scale: 1,
      opacity: 1,
      ease: "power2.out",
      scrollTrigger: { trigger: card, start: "top 88%", end: "top 48%", scrub: 0.5 },
    });
  });

  window.gsap.utils.toArray(".portal-stack-card").forEach((card, index) => {
    window.gsap.to(card, {
      y: index * -18,
      scale: 1 - index * 0.035,
      ease: "none",
      scrollTrigger: { trigger: card.parentElement, start: "top 72%", end: "bottom 32%", scrub: true },
    });
  });
}

window.addEventListener("load", initPortalMotion);

/* ── Admin Sub Tabs (Course Ops) ─────────────────────────── */
const subTabs = Array.from(document.querySelectorAll("[data-sub-tab]"));
const subPanels = Array.from(document.querySelectorAll("[data-sub-panel]"));

subTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.subTab;
    subTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    subPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.subPanel === target);
    });
  });
});

/* ── Global AI Teacher ───────────────────────────────────── */
function initAiTeacher() {
  if (!document.body.matches(".prototype-body, .community-body")) return;
  const shell = document.createElement("aside");
  shell.className = "ai-teacher-shell";
  shell.innerHTML = `
    <button class="ai-teacher-launcher" type="button" aria-label="打开星芽AI老师" aria-expanded="false">
      <span class="ai-bot-face" aria-hidden="true"><i></i><i></i></span><b>AI老师</b>
    </button>
    <section class="ai-teacher-panel" hidden>
      <header><span class="ai-bot-face" aria-hidden="true"><i></i><i></i></span><div><b>星芽AI老师</b><small>课程、创作与成长助手</small></div><button type="button" data-ai-close aria-label="关闭AI老师">关闭</button></header>
      <div class="ai-teacher-messages" data-ai-messages><p>我可以帮你解释课程、拆解任务、比较方案和修改表达，但不会直接替代孩子完成作品。</p></div>
      <div class="ai-teacher-prompts"><button type="button">帮我拆解任务</button><button type="button">怎么改得更清楚</button></div>
      <form data-ai-teacher-form><input aria-label="向星芽AI老师提问" placeholder="说说你正在想什么" /><button type="submit">发送</button></form>
    </section>
  `;
  document.body.append(shell);
  const launcher = shell.querySelector(".ai-teacher-launcher");
  const panel = shell.querySelector(".ai-teacher-panel");
  const input = shell.querySelector("input");
  const messages = shell.querySelector("[data-ai-messages]");

  function setOpen(open) {
    panel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    if (open) input.focus();
  }

  launcher.addEventListener("click", () => setOpen(panel.hidden));
  shell.querySelector("[data-ai-close]").addEventListener("click", () => setOpen(false));
  shell.querySelectorAll(".ai-teacher-prompts button").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.textContent;
      input.focus();
    });
  });
  shell.querySelector("[data-ai-teacher-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    appendMessage(messages, question, "is-user");
    input.value = "";
    const asksForAnswer = /直接|代写|帮我做完|完整答案/.test(question);
    const answer = asksForAnswer
      ? "我不能替你完成作业。先告诉我你观察到的一个真实问题，我会陪你比较三个表达方向。"
      : "先写下你的目标，再列出两个可能方案。你更希望观众看到问题、理解原因，还是采取行动？";
    appendMessage(messages, answer);
    messages.scrollTop = messages.scrollHeight;
  });
}

initAiTeacher();
