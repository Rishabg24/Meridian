/**
 * Persistent navigation shell.
 *
 * Lives outside <main>, so it survives every page swap. On a route change the
 * cobalt dot travels to the new link rather than cutting to it — the nav shows
 * you where you went.
 */

import { magnetize } from "./cursor.js";
import { prefersReduced } from "./motion.js";

export function initNav() {
  const nav = document.querySelector(".nav");
  const dot = nav?.querySelector(".nav__dot");
  const links = Array.from(nav?.querySelectorAll(".nav__link") || []);
  const burger = nav?.querySelector(".nav__burger");
  const sheet = document.querySelector(".nav-sheet");

  if (!nav) return { setPage() {} };

  links.forEach((link) => magnetize(link, { strength: 0.28 }));

  /* ---- condense past the opening viewport ---- */

  let condensed = null;
  const applyCondense = () => {
    const next = window.scrollY > 80;
    if (next === condensed) return;
    condensed = next;
    nav.classList.toggle("is-condensed", next);
  };
  applyCondense();
  window.addEventListener("scroll", applyCondense, { passive: true });

  /* ---- mobile sheet ---- */

  const setSheet = (open) => {
    if (!sheet || !burger) return;
    burger.setAttribute("aria-expanded", String(open));
    sheet.classList.toggle("is-open", open);
    sheet.setAttribute("aria-hidden", String(!open));
    document.body.style.overflow = open ? "hidden" : "";
    if (open) sheet.querySelector(".nav-sheet__link")?.focus();
  };

  burger?.addEventListener("click", () => {
    setSheet(burger.getAttribute("aria-expanded") !== "true");
  });

  sheet?.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("a")) setSheet(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && burger?.getAttribute("aria-expanded") === "true") {
      setSheet(false);
      burger.focus();
    }
  });

  /* ---- the travelling dot ---- */

  function moveDot(activeLink) {
    if (!dot || !activeLink) return;

    // Both offsetLeft reads are against the same offsetParent (.nav__links),
    // so this is one layout read, not a per-frame one.
    const x = activeLink.offsetLeft + activeLink.offsetWidth / 2 - 2;

    if (prefersReduced) {
      dot.style.transition = "none";
      dot.style.setProperty("--dot-x", `${x}px`);
      requestAnimationFrame(() => (dot.style.transition = ""));
    } else {
      dot.style.setProperty("--dot-x", `${x}px`);
    }

    dot.classList.add("is-visible");
  }

  /** Called by the router after every swap, and once on first paint. */
  function setPage(page) {
    let active = null;

    for (const link of links) {
      const match = link.dataset.page === page;
      if (match) {
        link.setAttribute("aria-current", "page");
        active = link;
      } else {
        link.removeAttribute("aria-current");
      }
    }

    document.querySelectorAll(".nav-sheet__link").forEach((link) => {
      if (link.dataset.page === page) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    if (active) moveDot(active);
    else dot?.classList.remove("is-visible");
  }

  window.addEventListener("resize", () => {
    const active = links.find((l) => l.hasAttribute("aria-current"));
    if (active) moveDot(active);
  }, { passive: true });

  return { setPage };
}

/** Anchor links inside a page scroll smoothly without corrupting ScrollTrigger. */
export function initAnchors() {
  document.addEventListener("click", (e) => {
    const link = e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (!link) return;

    const id = link.getAttribute("href");
    if (!id || id === "#") return;

    const target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
  });
}
