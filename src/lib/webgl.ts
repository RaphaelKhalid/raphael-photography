// WebGL gallery: overlays curtains.js planes on the existing DOM frames so the
// layout, lightbox and accessibility stay intact, while the images render through
// a scroll-velocity shader — a gentle bend + RGB channel-split on fast scroll, and
// a shader-driven fade/rise reveal. Degrades to plain DOM images if WebGL is
// unavailable, if the user prefers reduced motion, or if init fails.
import { Curtains, Plane } from "curtainsjs";
import type Lenis from "lenis";

const vertexShader = `
  precision mediump float;
  attribute vec3 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat4 uMVMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uTextureMatrix0;
  varying vec2 vTextureCoord;
  uniform float uVelocity;
  uniform float uAppear;
  void main() {
    vec3 pos = aVertexPosition;
    // bend the plane along its width, scaled by scroll velocity
    float bend = uVelocity * 0.045;
    pos.y += sin((pos.x + 1.0) * 1.5708) * bend;
    // reveal: rise from just below as uAppear 0 -> 1
    pos.y -= (1.0 - uAppear) * 0.12;
    gl_Position = uPMatrix * uMVMatrix * vec4(pos, 1.0);
    vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
  }`;

const fragmentShader = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler0;
  uniform float uVelocity;
  uniform float uAppear;
  void main() {
    float amt = clamp(abs(uVelocity) * 0.0016, 0.0, 0.018);
    vec2 dir = vec2(0.0, 1.0);
    float r = texture2D(uSampler0, vTextureCoord + dir * amt).r;
    float g = texture2D(uSampler0, vTextureCoord).g;
    float b = texture2D(uSampler0, vTextureCoord - dir * amt).b;
    gl_FragColor = vec4(r, g, b, uAppear);
  }`;

const supportsWebGL = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function initWebGL(lenis: Lenis | null): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (localStorage.getItem("webgl") === "off") return false;
  if (!supportsWebGL()) return false;

  const frames = Array.from(document.querySelectorAll<HTMLElement>(".flow .frame"));
  if (!frames.length) return false;

  const canvas = document.createElement("div");
  canvas.id = "webgl-canvas";
  document.body.appendChild(canvas);

  let curtains: any;
  try {
    curtains = new Curtains({
      container: canvas,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      watchScroll: true,
      alpha: true,
    });
  } catch { canvas.remove(); return false; }

  let failed = false;
  curtains.onError(() => { failed = true; document.documentElement.classList.remove("curtains-active"); canvas.remove(); });
  curtains.onContextLost(() => curtains.restoreContext());

  // curtains (watchScroll:true) tracks native scroll position itself — Lenis drives
  // real scroll, so we only need its velocity signal for the shader.
  let velocity = 0, smooth = 0;
  if (lenis) lenis.on("scroll", (e: any) => { velocity = e.velocity || 0; });

  const planes: any[] = [];
  try {
    frames.forEach((frameEl) => {
      const plane = new Plane(curtains, frameEl, {
        vertexShader, fragmentShader,
        transparent: true,
        widthSegments: 12, heightSegments: 1,
        uniforms: {
          uVelocity: { name: "uVelocity", type: "1f", value: 0 },
          uAppear:   { name: "uAppear",   type: "1f", value: 0 },
        },
      });
      // shader-driven reveal when the frame scrolls into view
      let target = 0;
      new IntersectionObserver((entries, obs) => {
        for (const en of entries) if (en.isIntersecting) { target = 1; obs.disconnect(); }
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }).observe(frameEl);
      (plane as any)._appearTarget = () => target;
      planes.push(plane);
    });
  } catch {
    planes.forEach((p) => { try { p.remove(); } catch { /* noop */ } });
    try { curtains.dispose(); } catch { /* noop */ }
    canvas.remove();
    return false;
  }

  if (!planes.length) { canvas.remove(); return false; }

  // hide the DOM images (and neutralise CSS reveals) only once WebGL is live
  document.documentElement.classList.add("curtains-active");

  curtains.onRender(() => {
    if (failed) return;
    smooth = lerp(smooth, velocity, 0.1);
    velocity *= 0.9;
    for (const p of planes) {
      const cur = p.uniforms.uAppear.value;
      const tgt = (p as any)._appearTarget ? (p as any)._appearTarget() : 1;
      p.uniforms.uAppear.value = lerp(cur, tgt, 0.06);
      p.uniforms.uVelocity.value = smooth;
    }
  });

  return true;
}
