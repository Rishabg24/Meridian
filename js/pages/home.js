/**
 * Home — the overture.
 *
 * One orchestrated entrance rather than a fade on every section. The thesis is
 * revealed by a masked wipe that pauses on the word "silence"; the meridian rule
 * draws underneath it; the rest of the page reveals only where a reveal earns
 * its place.
 */

import { revealWords, countUp, onceInView, prefersReduced } from "../core/motion.js";
import { magnetize } from "../core/cursor.js";

const teardown = [];

export function init({ fluid, obstacles }) {
  overture();
  consequence();
  panelAuras(fluid, obstacles);

  const handoff = document.querySelector(".handoff__link");
  if (handoff) teardown.push(magnetize(handoff, { strength: 0.16 }));
}

export function destroy() {
  while (teardown.length) teardown.pop()();
}

/* ---------------------------------------------------------------- */

function overture() {
  const thesis = document.querySelector(".overture__thesis");
  const rule = document.querySelector(".overture__rule");
  const attrib = document.querySelector(".overture__attrib");
  const cue = document.querySelector(".overture .scroll-cue");

  if (prefersReduced) {
    if (rule) rule.style.transform = "scaleX(1)";
    return;
  }

  const gsap = window.gsap;
  if (!gsap) {
    if (rule) rule.style.transform = "scaleX(1)";
    return;
  }

  // Each thesis line is revealed independently so "silence" can take its beat
  // without stalling the lines above it.
  const lines = Array.from(thesis?.querySelectorAll("[data-line]") || []);
  lines.forEach((line, i) => {
    revealWords(line, {
      delay: 0.25 + i * 0.18,
      stagger: 0.045,
      hold: line.dataset.hold || null,
    });
  });

  if (rule) {
    gsap.fromTo(
      rule,
      { scaleX: 0 },
      { scaleX: 1, duration: 1.5, ease: "expo.out", delay: 0.25 + lines.length * 0.18 }
    );
  }

  for (const el of [attrib, cue].filter(Boolean)) {
    gsap.fromTo(
      el,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.9, ease: "expo.out", delay: 1.35 }
    );
  }

  // The thesis recedes as you leave it. Derived from live progress each frame
  // rather than a scrub tween, so a mid-scroll ScrollTrigger.refresh() cannot
  // capture the dimmed state as its start value and stick there.
  const ScrollTrigger = window.ScrollTrigger;
  if (!ScrollTrigger || !thesis) return;

  const setThesis = gsap.quickSetter(thesis, "css");
  const apply = (p) => setThesis({ opacity: 1 - p * 0.72, scale: 1 - p * 0.06 });
  apply(0);

  const st = ScrollTrigger.create({
    trigger: ".overture",
    start: "top top",
    end: "bottom top",
    onUpdate: (self) => apply(self.progress),
    onLeave: () => apply(1),
    onLeaveBack: () => apply(0),
  });
  teardown.push(() => st.kill());

  const cueFade = gsap.to(cue, {
    opacity: 0,
    scrollTrigger: { trigger: ".overture", start: "top top", end: "22% top", scrub: true },
  });
  teardown.push(() => cueFade.scrollTrigger?.kill());
}

/* ---------------------------------------------------------------- */

/** The figures count into the sentence as it arrives. */
function consequence() {
  document.querySelectorAll("[data-count]").forEach((el) => {
    const target = el.dataset.count;
    // Render the final value first. If the observer never fires — headless
    // render, hidden tab, no JS — the sentence still reads correctly.
    el.textContent = parseFloat(target).toLocaleString("en-US", {
      minimumFractionDigits: (target.split(".")[1] || "").length,
      maximumFractionDigits: (target.split(".")[1] || "").length,
    });

    if (prefersReduced) return;

    onceInView(el, () => {
      el.textContent = "0";
      countUp(el, { duration: 1700 });
    }, { threshold: 1 });
  });
}

/* ---------------------------------------------------------------- */

/**
 * Panels gather ink of their own colour while the reader is on them. This is
 * the aura the fluid engine already knows how to render; we just tell it which
 * panel currently holds attention.
 */
function panelAuras(fluid, obstacles) {
  const panels = document.querySelectorAll("[data-obstacle]");

  panels.forEach((panel) => {
    const enter = () => obstacles.setActive(panel);
    const leave = () => {
      if (obstacles.activeEl === panel) obstacles.setActive(null);
    };

    panel.addEventListener("pointerenter", enter);
    panel.addEventListener("pointerleave", leave);
    panel.addEventListener("focusin", enter);
    panel.addEventListener("focusout", leave);

    teardown.push(() => {
      panel.removeEventListener("pointerenter", enter);
      panel.removeEventListener("pointerleave", leave);
      panel.removeEventListener("focusin", enter);
      panel.removeEventListener("focusout", leave);
    });
  });
}
