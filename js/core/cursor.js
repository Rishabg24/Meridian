/**
 * Velocity-aware cursor + magnetic hover.
 *
 * The ring trails the pointer on a spring and stretches along its motion
 * vector — the faster you move, the more it deforms, the way a droplet would.
 * Fine pointers only; touch keeps the native affordance and reduced motion
 * disables it entirely.
 */

import { ticker } from "./raf.js";
import { prefersReduced, damp, clamp } from "./motion.js";

const HOT = 'a, button, input, textarea, [data-magnetic], [data-cursor="hot"]';

export function initCursor() {
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (!finePointer || prefersReduced) return null;

  const root = document.createElement("div");
  root.className = "cursor";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = '<span class="cursor__ring"></span><span class="cursor__dot"></span>';
  document.body.appendChild(root);
  document.body.classList.add("has-custom-cursor");

  const ring = root.querySelector(".cursor__ring");
  const dotEl = root.querySelector(".cursor__dot");

  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const dot = { x: target.x, y: target.y };
  const trail = { x: target.x, y: target.y };

  let visible = false;

  const onMove = (e) => {
    target.x = e.clientX;
    target.y = e.clientY;
    if (!visible) {
      visible = true;
      root.style.opacity = "1";
    }
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", () => root.classList.add("is-pressed"));
  window.addEventListener("pointerup", () => root.classList.remove("is-pressed"));
  document.addEventListener("pointerleave", () => { root.style.opacity = "0"; visible = false; });

  // Hot-state is delegated, so it survives a page swap without rebinding.
  document.addEventListener("pointerover", (e) => {
    if (e.target instanceof Element && e.target.closest(HOT)) root.classList.add("is-hot");
  });
  document.addEventListener("pointerout", (e) => {
    if (e.target instanceof Element && e.target.closest(HOT)) root.classList.remove("is-hot");
  });

  const unsubscribe = ticker.add((dt) => {
    // The dot rides the pointer closely; the ring lags, which is what reads
    // as mass.
    dot.x = damp(dot.x, target.x, 0.55, dt);
    dot.y = damp(dot.y, target.y, 0.55, dt);

    const prevX = trail.x;
    const prevY = trail.y;
    trail.x = damp(trail.x, target.x, 0.82, dt);
    trail.y = damp(trail.y, target.y, 0.82, dt);

    const vx = trail.x - prevX;
    const vy = trail.y - prevY;
    const speed = Math.hypot(vx, vy);

    // Stretch along the direction of travel, squash across it. Capped so a
    // fast flick deforms rather than smears.
    const stretch = 1 + clamp(0, 0.42, speed / 34);
    const angle = speed > 0.01 ? Math.atan2(vy, vx) : 0;

    ring.style.setProperty("--ring-stretch", stretch.toFixed(3));
    if (speed > 0.01) ring.style.setProperty("--ring-angle", `${angle.toFixed(3)}rad`);

    root.style.transform = `translate3d(${trail.x}px, ${trail.y}px, 0)`;

    // The dot leads the ring, so it carries its own offset from the root.
    dotEl.style.transform = `translate3d(${dot.x - trail.x}px, ${dot.y - trail.y}px, 0)`;
  });

  return {
    destroy() {
      unsubscribe();
      window.removeEventListener("pointermove", onMove);
      root.remove();
      document.body.classList.remove("has-custom-cursor");
    },
  };
}

/**
 * Magnetic hover. The element leans toward the cursor while it is nearby and
 * springs back when it leaves. Applied to nav links and the submit button.
 */
export function magnetize(el, { strength = 0.32 } = {}) {
  if (prefersReduced || !window.matchMedia("(pointer: fine)").matches) return () => {};

  let raf = null;
  let rect = null;
  const state = { x: 0, y: 0, tx: 0, ty: 0 };

  // The rect is read once, when the pointer arrives — never inside the move
  // handler, where it would force a layout on every mouse event.
  const onEnter = () => { rect = el.getBoundingClientRect(); };

  const onMove = (e) => {
    if (!rect) rect = el.getBoundingClientRect();
    state.tx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    state.ty = (e.clientY - (rect.top + rect.height / 2)) * strength;
    if (raf === null) raf = requestAnimationFrame(step);
  };

  const step = () => {
    state.x += (state.tx - state.x) * 0.18;
    state.y += (state.ty - state.y) * 0.18;
    el.style.transform = `translate3d(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px, 0)`;

    if (Math.abs(state.x - state.tx) > 0.05 || Math.abs(state.y - state.ty) > 0.05) {
      raf = requestAnimationFrame(step);
    } else {
      raf = null;
      if (state.tx === 0 && state.ty === 0) el.style.transform = "";
    }
  };

  const onLeave = () => {
    rect = null;
    state.tx = 0;
    state.ty = 0;
    if (raf === null) raf = requestAnimationFrame(step);
  };

  el.addEventListener("pointerenter", onEnter);
  el.addEventListener("pointermove", onMove, { passive: true });
  el.addEventListener("pointerleave", onLeave);
  window.addEventListener("scroll", onLeave, { passive: true });

  return () => {
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("scroll", onLeave);
    if (raf !== null) cancelAnimationFrame(raf);
    el.style.transform = "";
  };
}
