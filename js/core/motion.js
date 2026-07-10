/**
 * Shared motion vocabulary: easings, the reduced-motion gate, and the reveal
 * primitives every page builds on.
 *
 * Rule enforced here: a reveal enhances an already-visible default. We never
 * ship a "from" state in CSS. JS sets the from-state immediately before it
 * animates, so a page with broken or disabled JS renders fully readable.
 */

import { ticker } from "./raf.js";

export const prefersReduced = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

export const clamp = (min, max, v) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * A critically-damped spring step. Reaches the target without overshoot, which
 * is what "inertia without bounce" actually means. `smoothing` is the fraction
 * of remaining distance left after one 60fps frame.
 */
export function damp(current, target, smoothing, dt) {
  return lerp(current, target, 1 - Math.pow(smoothing, dt));
}

/**
 * Fire `cb` once, the first time `el` crosses into view. Unobserves itself.
 * Under reduced motion it fires immediately so nothing waits on a scroll.
 */
export function onceInView(el, cb, { threshold = 0.2, rootMargin = "0px 0px -8% 0px" } = {}) {
  if (prefersReduced || !("IntersectionObserver" in window)) {
    cb(el);
    return () => {};
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        io.unobserve(entry.target);
        cb(entry.target);
      }
    },
    { threshold, rootMargin }
  );

  io.observe(el);
  return () => io.disconnect();
}

/**
 * Run `enter` / `exit` as `el` enters and leaves view. Used to gate the service
 * canvases so only the visible one consumes a frame.
 */
export function whileInView(el, { enter, exit, threshold = 0 } = {}) {
  if (!("IntersectionObserver" in window)) {
    enter?.();
    return () => {};
  }

  const io = new IntersectionObserver(
    ([entry]) => (entry.isIntersecting ? enter?.() : exit?.()),
    { threshold }
  );

  io.observe(el);
  return () => io.disconnect();
}

/**
 * Split an element's text into words wrapped for masked reveal.
 * Produces: .mask-line > span per word, preserving spaces between them.
 * Returns the inner spans, in order, for staggering.
 *
 * Accessibility: the source text is preserved verbatim in the DOM, and we set
 * aria-label on the host so screen readers read the sentence, not the shards.
 */
export function splitWords(el) {
  const source = el.textContent.trim();
  const words = source.split(/\s+/);

  el.setAttribute("aria-label", source);
  el.textContent = "";

  const inners = words.map((word, i) => {
    const line = document.createElement("span");
    line.className = "mask-line";
    line.setAttribute("aria-hidden", "true");
    line.style.display = "inline-block";

    const inner = document.createElement("span");
    inner.textContent = word;
    line.appendChild(inner);

    el.appendChild(line);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));

    return inner;
  });

  return inners;
}

/**
 * The house reveal: a masked wipe upward, staggered.
 * `hold` names a word that should linger a beat longer than its neighbours —
 * the motion performing the sentence rather than decorating it.
 */
export function revealWords(el, { delay = 0, stagger = 0.055, hold = null, holdBeat = 0.34 } = {}) {
  const gsap = window.gsap;
  if (prefersReduced || !gsap) return;

  const inners = splitWords(el);

  const normalize = (s) => s.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const holdIndex = hold ? inners.findIndex((s) => normalize(s.textContent) === normalize(hold)) : -1;

  gsap.set(inners, { yPercent: 105 });

  // Explicit per-word delays rather than a stagger object: the held word takes
  // its beat, and every word after it inherits that pause. A stagger config
  // cannot express "pause mid-sentence".
  inners.forEach((inner, i) => {
    const pause = holdIndex >= 0 && i > holdIndex ? holdBeat : 0;
    gsap.to(inner, {
      yPercent: 0,
      duration: i === holdIndex ? 1.35 : 1.05,
      ease: "expo.out",
      delay: delay + i * stagger + pause,
    });
  });
}

/**
 * Count a number up as it scrolls into its sentence. Formats with locale
 * separators and preserves any suffix already in the DOM (e.g. "million").
 */
export function countUp(el, { duration = 1600 } = {}) {
  const target = parseFloat(el.dataset.count);
  if (!Number.isFinite(target)) return;

  const decimals = (el.dataset.count.split(".")[1] || "").length;
  const format = (v) =>
    v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  if (prefersReduced) {
    el.textContent = format(target);
    return;
  }

  const startedAt = performance.now();
  const unsubscribe = ticker.add((_dt, now) => {
    const t = clamp(0, 1, (now - startedAt) / duration);
    // ease-out-expo, so the figure decelerates into its final value
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    el.textContent = format(target * eased);
    if (t === 1) unsubscribe();
  });
}
