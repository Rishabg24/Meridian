/**
 * MERIDIAN — bootstrap.
 *
 * Builds the persistent shell once (canvas, cursor, nav, transitions), then
 * mounts and unmounts one page module per route. Page modules own everything
 * inside <main> and must clean up after themselves — every ScrollTrigger, every
 * ticker subscription, every listener.
 */

import { FluidEngine } from "./core/fluid.js";
import { obstacles } from "./core/obstacles.js";
import { initCursor } from "./core/cursor.js";
import { initNav, initAnchors } from "./core/nav.js";
import { initTransitions } from "./core/transition.js";

import * as home from "./pages/home.js";
import * as services from "./pages/services.js";
import * as experience from "./pages/experience.js";
import * as contact from "./pages/contact.js";

const PAGES = { home, services, experience, contact };

function boot() {
  const canvas = document.getElementById("fluid-canvas");
  const fluid = canvas ? new FluidEngine(canvas) : null;

  initCursor();
  initAnchors();
  const nav = initNav();

  if (window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    // A refresh remeasures the document; the obstacle rects must follow.
    ScrollTrigger.addEventListener("refresh", () => obstacles.invalidate());
  }

  let currentPage = null;

  function mount(page) {
    // Tear down the outgoing page completely before the next one measures
    // anything, or its ScrollTriggers will fight over the same scroll positions.
    if (currentPage) {
      PAGES[currentPage]?.destroy?.();
      window.ScrollTrigger?.getAll().forEach((t) => t.kill());
    }

    currentPage = page;

    // The registry re-collects from the freshly swapped DOM.
    obstacles.collect();

    PAGES[page]?.init?.({ fluid, obstacles });
    nav.setPage(page);

    window.ScrollTrigger?.refresh();
  }

  initTransitions({ onMount: mount, fluid });

  const first = document.body.dataset.page || "home";
  fluid?.setMood(first);
  mount(first);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
