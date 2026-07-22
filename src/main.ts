import "./styles.css";
import { photos, series, hero, bySeries, seriesBySlug, type Photo } from "./data/photos";
import { frame, header, footer } from "./lib/dom";
import { initSmoothScroll, initReveals, initParallax } from "./lib/motion";

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  const btn = document.getElementById("theme-toggle");
  const label = () => {
    const dark = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg").trim().startsWith("#0");
    if (btn) btn.textContent = dark ? "light" : "dark";
  };
  label();
  btn?.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    label();
  });
}

/* ---------------- header recede on scroll ---------------- */
function initHeaderScroll() {
  const head = document.querySelector(".site-head");
  if (!head) return;
  const onScroll = () => head.classList.toggle("shrink", window.scrollY > 80);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
}

/* ---------------- lightbox ---------------- */
function initLightbox(set: Photo[]) {
  if (!set.length) return;
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Image viewer");
  lb.innerHTML = `
    <button class="lb-close" type="button" aria-label="Close viewer">close ✕</button>
    <button class="lb-nav prev" type="button" aria-label="Previous">‹</button>
    <img alt="">
    <button class="lb-nav next" type="button" aria-label="Next">›</button>
    <div class="lb-index" aria-live="polite"></div>`;
  document.body.appendChild(lb);
  const img = lb.querySelector("img") as HTMLImageElement;
  const idxEl = lb.querySelector(".lb-index") as HTMLElement;
  let i = 0, lastFocus: HTMLElement | null = null;

  const wide = () => {
    const ws: number[] = (window as any).__widths(set[i]);
    const target = window.innerWidth * (window.devicePixelRatio || 1);
    return ws.find((w) => w >= target) ?? ws[ws.length - 1]; // smallest tier that covers the viewport
  };
  const show = (n: number) => {
    i = (n + set.length) % set.length;
    const p = set[i];
    img.classList.remove("loaded");
    const supportsAvif = document.createElement("canvas").toDataURL("image/avif").startsWith("data:image/avif");
    img.src = `/img/${p.base}-${wide()}.${supportsAvif ? "avif" : "webp"}`;
    img.alt = p.alt;
    idxEl.textContent = `${String(i + 1).padStart(2, "0")} / ${String(set.length).padStart(2, "0")}`;
    if (img.complete) img.classList.add("loaded");
    else img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  };
  const open = (n: number) => {
    lastFocus = document.activeElement as HTMLElement;
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    show(n);
    (lb.querySelector(".lb-close") as HTMLElement).focus();
  };
  const close = () => {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  };

  lb.querySelector(".lb-close")!.addEventListener("click", close);
  lb.querySelector(".prev")!.addEventListener("click", () => show(i - 1));
  lb.querySelector(".next")!.addEventListener("click", () => show(i + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  lb.addEventListener("mousemove", () => lb.classList.add("cursor-mode"), { once: true });

  addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(i - 1);
    else if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "Tab") { e.preventDefault(); } // focus trap: keep focus inside
  });

  // swipe
  let x0: number | null = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // wire triggers
  const trigger = (node: Element) => {
    const openIt = () => open(Number((node as HTMLElement).dataset.index || 0));
    node.addEventListener("click", openIt);
    node.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === "Enter" || k === " ") { e.preventDefault(); openIt(); }
    });
  };
  document.querySelectorAll(".frame[data-index]").forEach(trigger);
}

/* ---------------- gallery builders ---------------- */
const MASONRY_SIZES = "(max-width: 700px) 100vw, (max-width: 1500px) 45vw, 340px";
const HERO_SIZES = "(max-width: 1500px) 100vw, 1500px";

function renderMasonry(mount: HTMLElement, set: Photo[], offset = 0) {
  const grid = document.createElement("div");
  grid.className = "masonry";
  set.forEach((p, idx) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("data-reveal", "");
    cell.appendChild(frame(p, { sizes: MASONRY_SIZES, index: idx + offset }));
    grid.appendChild(cell);
  });
  mount.appendChild(grid);
}

/* ---------------- routes ---------------- */
function renderHome(app: HTMLElement) {
  // home lightbox set: hero first, then the rest in curated series order
  const rest = photos.filter((p) => p.base !== hero.base);
  const set = [hero, ...rest];

  // ---- full-viewport hero ----
  const heroSec = el(`
    <section class="hero-full">
      <div class="bleed" data-parallax="70"></div>
      <div class="hero-caption" data-reveal>
        <span class="sub">san francisco · after hours &amp; in between</span>
        <span class="lede">the city once the light goes.</span>
      </div>
      <span class="scroll-cue">scroll</span>
    </section>`);
  const heroFrame = frame(hero, { sizes: HERO_SIZES, eager: true, index: 0 });
  heroSec.querySelector(".bleed")!.appendChild(heroFrame);

  // ---- editorial flow of "movements" ----
  const flow = el(`<div class="flow"></div>`);
  const shortCap = (p: Photo) => p.alt.toLowerCase().replace(/\.$/, "");
  const singleCycle = ["m-bleed", "m-full", "m-offset-l", "m-full", "m-offset-r"];
  let idx = 1, cyc = 0;

  const singleFrame = (p: Photo, sizes: string) => {
    const f = frame(p, { sizes, index: idx++ });
    return f;
  };

  for (let j = 0; j < rest.length; ) {
    const p = rest[j];
    const next = rest[j + 1];
    if (p.orientation === "portrait" && next && next.orientation === "portrait") {
      // paired portraits, staggered
      const m = el(`<div class="movement m-pair stagger wrap" data-reveal></div>`);
      const c1 = el(`<div class="p1"></div>`), c2 = el(`<div class="p2"></div>`);
      c1.appendChild(singleFrame(p, "(max-width:720px) 100vw, 46vw"));
      c2.appendChild(singleFrame(next, "(max-width:720px) 100vw, 46vw"));
      m.append(c1, c2);
      flow.appendChild(m);
      j += 2;
      continue;
    }
    const cls = p.orientation === "portrait"
      ? (cyc % 2 ? "m-offset-r" : "m-offset-l")
      : singleCycle[cyc % singleCycle.length];
    cyc++;
    const bleed = cls === "m-bleed";
    const m = el(`<div class="movement ${cls} ${bleed ? "" : "wrap"}" data-reveal></div>`);
    const inner = el(`<div class="inner"></div>`);
    const sizes = bleed ? "100vw" : cls === "m-full" ? HERO_SIZES : "(max-width:720px) 100vw, 64vw";
    inner.appendChild(singleFrame(p, sizes));
    inner.appendChild(el(`<div class="m-caption">${shortCap(p)}</div>`));
    m.appendChild(inner);
    flow.appendChild(m);
    j += 1;
  }

  // ---- closing chapter: series links ----
  const chapters = el(`<div class="wrap pad-bot" style="margin-top:clamp(60px,10vw,120px)"></div>`);
  chapters.appendChild(el(`<div class="section-head" data-reveal><span class="eyebrow">the work, in three parts</span></div>`));
  series.slice().sort((a, b) => a.order - b.order).forEach((s) => {
    const set2 = bySeries(s.slug);
    chapters.appendChild(el(`
      <div class="chapter" data-reveal>
        <span class="c-title"><a href="/series/${s.slug}/">${s.title}</a></span>
        <span class="c-meta">${String(set2.length).padStart(2, "0")} frames →</span>
      </div>`));
  });

  app.append(heroSec, flow, chapters);
  return set;
}

function renderSeriesIndex(app: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "wrap pad-top pad-bot";
  wrap.appendChild(el(`<div class="section-head"><h1 class="title-lg">series</h1></div>`));
  series.sort((a, b) => a.order - b.order).forEach((s, n) => {
    const set = bySeries(s.slug);
    const cover = set[0];
    const row = document.createElement("div");
    row.className = "series-row" + (n % 2 ? " flip" : "");
    const cov = document.createElement("a");
    cov.href = `/series/${s.slug}/`;
    cov.style.display = "block";
    cov.setAttribute("aria-label", `${s.title} — ${set.length} frames`);
    cov.appendChild(frame(cover, { sizes: "(max-width:760px) 100vw, 48vw", cover: true }));
    const text = el(`
      <div class="series-text">
        <a href="/series/${s.slug}/"><h2 class="series-title">${s.title}</h2></a>
        <p>${s.blurb}</p>
        <span class="count">${String(set.length).padStart(2, "0")} frames →</span>
      </div>`);
    row.append(text, cov);
    wrap.appendChild(row);
  });
  app.appendChild(wrap);
  return [];
}

function renderSeriesDetail(app: HTMLElement, slug: string) {
  const s = seriesBySlug(slug);
  const set = bySeries(slug);
  if (!s || !set.length) { location.replace("/series/"); return []; }
  const wrap = document.createElement("div");
  wrap.className = "wrap pad-top pad-bot";
  wrap.appendChild(el(`
    <div class="section-head">
      <div><span class="eyebrow">series</span><h1 class="title-lg">${s.title}</h1></div>
      <span class="count">${String(set.length).padStart(2, "0")} frames</span>
    </div>`));
  renderMasonry(wrap, set);
  app.appendChild(wrap);
  document.title = `${s.title} — raphael`;
  return set;
}

function renderAbout(app: HTMLElement) {
  app.appendChild(el(`
    <div class="wrap"><div class="plain">
      <span class="eyebrow">about</span>
      <p class="big">raphael</p>
      <p>Photographs of San Francisco after hours and in between — blue hour, fog, lamplight and the wild edges of the city. Shot on a Nikon; graded for a cinematic, low-light mood.</p>
    </div></div>`));
  return [];
}

function renderContact(app: HTMLElement) {
  app.appendChild(el(`
    <div class="wrap"><div class="plain">
      <span class="eyebrow">contact</span>
      <a class="mail" href="mailto:raphaelbahadurkhan@gmail.com">raphaelbahadurkhan@gmail.com</a>
    </div></div>`));
  return [];
}

/* small local el() */
function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/* ---------------- boot ---------------- */
function boot() {
  const root = document.getElementById("app")!;
  const route = root.dataset.route!;
  const slug = root.dataset.slug || "";

  document.body.prepend(el(`<a class="skip" href="#app">Skip to content</a>`));
  document.body.prepend(header(route === "series" ? "series"
    : route === "about" ? "about" : route === "contact" ? "contact" : ""));

  let set: Photo[] = [];
  if (route === "home") set = renderHome(root);
  else if (route === "series") set = renderSeriesIndex(root);
  else if (route === "series-detail") set = renderSeriesDetail(root, slug);
  else if (route === "about") set = renderAbout(root);
  else if (route === "contact") set = renderContact(root);

  document.body.appendChild(footer());
  initTheme();
  initHeaderScroll();
  initLightbox(set);

  // experiential motion
  const lenis = initSmoothScroll();
  initReveals();
  initParallax(lenis);
}

document.addEventListener("DOMContentLoaded", boot);
