import Lenis from "lenis";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Inertia / smooth scrolling. Returns the Lenis instance (or null when reduced). */
export function initSmoothScroll(): Lenis | null {
  if (reduced()) return null;
  const lenis = new Lenis({
    duration: 1.1,
    easing: (t) => 1 - Math.pow(1 - t, 3), // easeOutCubic
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
  });
  const raf = (time: number) => { lenis.raf(time); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.documentElement.classList.add("lenis");
  return lenis;
}

/** Fade + rise reveals for anything tagged [data-reveal]. */
export function initReveals(root: ParentNode = document) {
  const items = root.querySelectorAll<HTMLElement>("[data-reveal]:not(.revealed)");
  if (reduced()) { items.forEach((el) => el.classList.add("revealed")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const el = e.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay || 0);
        setTimeout(() => el.classList.add("revealed"), delay);
        io.unobserve(el);
      }
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  items.forEach((el) => io.observe(el));
}

/** Subtle parallax: elements move at [data-parallax] * scroll progress through the viewport. */
export function initParallax(lenis: Lenis | null) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!nodes.length || reduced()) return;
  const apply = () => {
    const vh = window.innerHeight;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const progress = (center - vh / 2) / vh; // -1 (below) .. 1 (above)
      const amt = Number(el.dataset.parallax || 0);
      el.style.setProperty("--py", `${(-progress * amt).toFixed(1)}px`);
    }
  };
  if (lenis) lenis.on("scroll", apply);
  else addEventListener("scroll", apply, { passive: true });
  addEventListener("resize", apply);
  apply();
}
