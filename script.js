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
const reason = document.querySelector("[data-auth-reason]");
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authPanels = Array.from(document.querySelectorAll("[data-auth-panel]"));
let pendingAction = "";
let isStudentLoggedIn = false;

document.querySelectorAll("[data-gated]").forEach((button) => {
  button.addEventListener("click", () => {
    pendingAction = button.dataset.gated;
    if (isStudentLoggedIn) {
      showToast(`已进入：${pendingAction}`);
      return;
    }
    openAuth("student", `请先登录/注册，再继续"${pendingAction}"。`);
  });
});

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    openAuth(button.dataset.openAuth || "student");
  });
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

document.querySelector("[data-student-login]")?.addEventListener("click", () => {
  isStudentLoggedIn = true;
  closeAuth();
  showToast("学生登录成功");
  window.location.href = "student.html";
});

document.querySelector("[data-admin-login]")?.addEventListener("click", () => {
  window.location.href = "admin.html";
});

function openAuth(type = "student", message) {
  if (!modal) return;
  setAuthTab(type);
  if (reason) {
    reason.textContent = message || "登录后可预约体验课、报名活动、提问答疑。";
  }
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

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
    });
  });
});

document.querySelectorAll("[data-admin-action]").forEach((button) => {
  button.addEventListener("click", () => {
    showToast(`${button.dataset.adminAction}：已生成演示反馈`);
  });
});

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

/* ── Nav Scroll Opacity ─────────────────────────────────── */
const topNav = document.querySelector("[data-top-nav]");
const adminTopNav = document.querySelector("[data-admin-topnav]");
const studentNav = document.querySelector("[data-student-nav]");
const navEl = topNav || adminTopNav || studentNav;

if (navEl) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 40) {
      navEl.style.background = "rgba(255,255,255,0.92)";
      navEl.style.borderBottomColor = "#d2d2d7";
    } else {
      navEl.style.background = "rgba(255,255,255,0.72)";
      navEl.style.borderBottomColor = "#e8e8ed";
    }
  });
}

/* ── Nav Active State (scroll-based) ────────────────────── */
const sections = document.querySelectorAll(".section, .section-alt, .hero");
const navLinks = document.querySelector(".nav-links");

if (sections.length && navLinks) {
  const links = navLinks.querySelectorAll("a");
  window.addEventListener("scroll", () => {
    let current = "home";
    sections.forEach((section) => {
      const top = section.offsetTop - 100;
      if (window.scrollY >= top) {
        current = section.id || "home";
      }
    });
    links.forEach((link) => {
      const href = link.getAttribute("href")?.replace("#", "");
      link.classList.toggle("is-active", href === current);
    });
  });
}

/* ── Student Tabs ────────────────────────────────────────── */
const studentTabs = Array.from(document.querySelectorAll("[data-student-tab]"));
const studentPanels = Array.from(document.querySelectorAll("[data-student-panel]"));

studentTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.studentTab;
    studentTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
    studentPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.studentPanel === target);
    });
  });
});

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