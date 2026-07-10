/**
 * Shared scaffolding for the four service canvases.
 *
 * Each service owns a bespoke visual, but they all need the same three things:
 * a correctly scaled backing store, a pointer position in CSS pixels, and a
 * subscription that only runs while the stage is on screen.
 */

import { ticker } from "../core/raf.js";
import { prefersReduced } from "../core/motion.js";

export const INK = {
  obsidian: "#0B0B0B",
  cobalt: "#0047AB",
  coral: "#FF7F50",
  linen: "#F5F4F0",
  // Text drawn to canvas owes the same 4.5:1 as text in the DOM. .45 alpha is
  // 3.1:1 on linen and fails; .62 is 5.4:1.
  muted: "rgba(11,11,11,.62)",
  hair: "rgba(11,11,11,.18)",
  ghost: "rgba(11,11,11,.08)",
};

export const MONO = '500 12px "JetBrains Mono", monospace';

/** Deterministic PRNG so a layout is identical on every load and every reload. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Map a progress window onto 0..1. Outside the window it saturates. */
export const phase = (p, from, to) => clamp01((p - from) / (to - from));

export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInQuart = (t) => t * t * t * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Wire a canvas to its element box and the shared ticker.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} handlers
 * @param {(ctx: CanvasRenderingContext2D, s: Stage) => void} handlers.draw
 * @param {(s: Stage) => void} [handlers.layout] called after every resize
 */
export function createStage(canvas, { draw, layout }) {
  const ctx = canvas.getContext("2d");

  const stage = {
    ctx,
    w: 0,
    h: 0,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    progress: 0,
    time: 0,
    /** Frame delta in 60fps units. Scale all motion by this or a 120Hz display
        runs the simulation at double speed. */
    dt: 1,
    pointer: { x: -9999, y: -9999, inside: false },
    running: false,
  };

  let unsubscribe = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    stage.w = rect.width;
    stage.h = rect.height;
    canvas.width = Math.round(rect.width * stage.dpr);
    canvas.height = Math.round(rect.height * stage.dpr);
    ctx.setTransform(stage.dpr, 0, 0, stage.dpr, 0, 0);

    layout?.(stage);
    if (!stage.running) render(0);
  }

  function render(dt) {
    stage.dt = dt || 1;
    stage.time += stage.dt;
    ctx.clearRect(0, 0, stage.w, stage.h);
    draw(ctx, stage);
  }

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    stage.pointer.x = e.clientX - rect.left;
    stage.pointer.y = e.clientY - rect.top;
    stage.pointer.inside =
      stage.pointer.x >= 0 && stage.pointer.x <= stage.w &&
      stage.pointer.y >= 0 && stage.pointer.y <= stage.h;
  };

  const onPointerLeave = () => { stage.pointer.inside = false; };

  canvas.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onPointerLeave);

  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });

  resize();

  return {
    stage,

    setProgress(p) {
      stage.progress = clamp01(p);
      // A scrubbed stage must repaint even when parked, or scrolling past it
      // with reduced motion on would leave it frozen at its entry frame.
      if (!stage.running) render(0);
    },

    start() {
      if (stage.running) return;

      // A stage under `content-visibility: auto` has no layout boxes while it
      // is off screen, so the constructor's resize() measured zero and bailed.
      // Re-measure on the way in, or we would paint into a 300x150 default.
      if (!stage.w) resize();

      // Under reduced motion the visual is a still diagram at its final state,
      // not an idle loop.
      if (prefersReduced) {
        stage.progress = 1;
        render(0);
        return;
      }
      stage.running = true;
      unsubscribe = ticker.add((dt) => render(dt));
    },

    stop() {
      if (!stage.running) return;
      stage.running = false;
      unsubscribe?.();
      unsubscribe = null;
    },

    resize,

    destroy() {
      this.stop();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
    },
  };
}

/** Rounded rectangle path, since roundRect() is still uneven across browsers. */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
