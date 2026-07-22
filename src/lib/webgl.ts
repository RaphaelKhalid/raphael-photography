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
    // uniform overscan (preserves aspect) so the velocity bend never reveals the edge
    pos.xy *= 1.09;
    // gentle bend along the width, scaled by scroll velocity (clamped)
    float v = clamp(uVelocity, -16.0, 16.0);
    float bend = v * 0.0025;
    pos.y += sin((pos.x + 1.0) * 1.5708) * bend;
    gl_Position = uPMatrix * uMVMatrix * vec4(pos, 1.0);
    vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
  }`;

const fragmentShader = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler0;
  uniform float uVelocity;
  void main() {
    float amt = clamp(abs(uVelocity) * 0.00028, 0.0, 0.004);
    vec2 dir = vec2(0.0, 1.0);
    float r = texture2D(uSampler0, vTextureCoord + dir * amt).r;
    float g = texture2D(uSampler0, vTextureCoord).g;
    float b = texture2D(uSampler0, vTextureCoord - dir * amt).b;
    gl_FragColor = vec4(r, g, b, 1.0);
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
        widthSegments: 12, heightSegments: 1,
        uniforms: {
          uVelocity: { name: "uVelocity", type: "1f", value: 0 },
        },
      });
      // hide this frame's DOM image only once its plane (and texture) are ready,
      // so a frame is never blank (plane draws at full opacity immediately)
      plane.onReady(() => frameEl.classList.add("gl-ready"));
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

  // recompute plane geometry after layout/fonts/images settle — grid-based strip
  // cells aren't sized at synchronous init, so their planes start mispositioned
  const resize = () => { try { curtains.resize(); planes.forEach((p) => p.resize()); } catch { /* noop */ } };
  addEventListener("load", resize);
  [120, 400, 900, 1800].forEach((t) => setTimeout(resize, t));
  frames.forEach((f) => { const im = f.querySelector("img"); if (im && !im.complete) im.addEventListener("load", resize, { once: true }); });

  curtains.onRender(() => {
    if (failed) return;
    smooth = lerp(smooth, velocity, 0.1);
    velocity *= 0.9;
    for (const p of planes) p.uniforms.uVelocity.value = smooth;
  });

  return true;
}
