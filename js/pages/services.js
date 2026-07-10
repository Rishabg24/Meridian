/**
 * Services.
 *
 * Four sticky stages, each with a bespoke canvas. Scroll position within a stage
 * is the canvas's `progress`; an IntersectionObserver decides which single canvas
 * is allowed to consume a frame. Only the visible one ever ticks.
 */

import { whileInView, prefersReduced } from "../core/motion.js";
import * as design from "../services/design.js";
import * as collect from "../services/collect.js";
import * as analyze from "../services/analyze.js";
import * as solve from "../services/solve.js";

const FACTORIES = { design, collect, analyze, solve };

const teardown = [];
let instances = [];

export function init({ obstacles }) {
  // Constraint state is shared with the solve canvas by reference, so a slider
  // drag is reflected on the very next frame without any event plumbing.
  const weights = { budget: 0.7, capacity: 0.6, politics: 0.5 };

  document.querySelectorAll("[data-canvas]").forEach((canvas) => {
    const kind = canvas.dataset.canvas;
    const factory = FACTORIES[kind];
    if (!factory) return;

    const instance = factory.create(canvas, { weights });
    instances.push(instance);

    const stage = canvas.closest(".stage");

    // Park the canvas whenever it leaves the viewport.
    const stopWatching = whileInView(stage, {
      enter: () => instance.start(),
      exit: () => instance.stop(),
    });
    teardown.push(stopWatching);

    // Scrub progress from the stage's scroll span.
    //
    // The window opens as the panel enters the viewport, not when the stage
    // pins. The sticky inner is visible for nearly a full viewport before its
    // stage top reaches y=0; starting at "top top" would leave the reader
    // looking at an empty bordered box for all of it.
    if (window.ScrollTrigger && !prefersReduced) {
      const apply = (self) => instance.setProgress(self.progress * 1.15);

      const st = ScrollTrigger.create({
        trigger: stage,
        start: "top 88%",
        end: "bottom bottom",
        onUpdate: apply,
        onRefresh: apply,       // seed progress on first measure, not only on scroll
        onEnterBack: () => instance.start(),
      });
      teardown.push(() => st.kill());
    } else {
      instance.setProgress(1);
    }

    teardown.push(() => instance.destroy());
  });

  initWeights(weights);
  initTextReveals();
  initPanelAuras(obstacles);
}

export function destroy() {
  while (teardown.length) teardown.pop()();
  instances = [];
}

/* ---------------------------------------------------------------- */

function initWeights(weights) {
  document.querySelectorAll(".weight__input").forEach((input) => {
    const key = input.dataset.weight;
    const readout = input.parentElement.querySelector(".weight__value");

    const sync = () => {
      weights[key] = Number(input.value) / 100;
      if (readout) readout.textContent = `${input.value}%`;
    };

    sync();
    input.addEventListener("input", sync);
    teardown.push(() => input.removeEventListener("input", sync));
  });
}

/* ---------------------------------------------------------------- */

function initTextReveals() {
  const gsap = window.gsap;
  if (!gsap || !window.ScrollTrigger || prefersReduced) return;

  document.querySelectorAll(".stage__text").forEach((text) => {
    const parts = text.querySelectorAll(".stage__index, .stage__title, .stage__body, .caps, .weights");

    // The from-state is set here, at animation time. Nothing in CSS hides this
    // content, so a failed script leaves a fully readable page.
    const tween = gsap.fromTo(
      parts,
      { opacity: 0, y: 26 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.07,
        scrollTrigger: { trigger: text, start: "top 78%" },
      }
    );
    teardown.push(() => tween.scrollTrigger?.kill());
  });
}

/* ---------------------------------------------------------------- */

function initPanelAuras(obstacles) {
  document.querySelectorAll("[data-obstacle]").forEach((panel) => {
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
