/**
 * The meridian wipe.
 *
 * Internal links are intercepted, the next document is fetched, and only <main>
 * is swapped. The canvas, grain, vignette, nav and cursor never unmount, so the
 * fluid simulation carries its full state — momentum, colour, aura — across the
 * navigation. That continuity is the whole point; four hard-loaded pages cannot
 * fake it.
 *
 * A single cobalt hairline traverses the viewport once. The outgoing page is
 * clipped to the right of the line, the incoming page to its left. Both are on
 * screen simultaneously, so the line reads as an edge rather than a curtain.
 *
 * Progressive enhancement: if fetch fails, or JS never runs, the links are
 * ordinary hrefs to ordinary HTML files.
 */

import { prefersReduced, clamp } from "./motion.js";
import { ticker } from "./raf.js";

const DURATION = 900;

export function initTransitions({ onMount, fluid }) {
  const wipe = document.querySelector(".wipe");
  let navigating = false;

  /* ---- link interception ---- */

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const link = e.target instanceof Element && e.target.closest("a[href]");
    if (!link) return;

    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (link.hasAttribute("download") || link.target === "_blank") return;
    if (url.pathname === location.pathname) return; // same page: let anchors work

    e.preventDefault();
    navigate(url.href, { push: true });
  });

  window.addEventListener("popstate", () => {
    navigate(location.href, { push: false });
  });

  /* ---- navigation ---- */

  async function navigate(href, { push }) {
    if (navigating) return;
    navigating = true;
    document.body.classList.add("is-transitioning");

    let doc;
    try {
      const res = await fetch(href, { headers: { "X-Requested-With": "fetch" } });
      if (!res.ok) throw new Error(`${res.status}`);
      doc = new DOMParser().parseFromString(await res.text(), "text/html");
    } catch {
      // The network is the source of truth. If we cannot fetch it, hand the
      // navigation back to the browser rather than stranding the user.
      location.href = href;
      return;
    }

    const incoming = doc.querySelector("main");
    const outgoing = document.querySelector("main");
    if (!incoming || !outgoing) {
      location.href = href;
      return;
    }

    const page = doc.body.dataset.page || "home";

    document.title = doc.title;
    syncMeta(doc);
    const addedLinks = syncHead(doc);

    // Wait for new stylesheets to load so we don't FOUC the incoming page during the wipe
    if (addedLinks.length > 0) {
      await Promise.all(addedLinks.map(link => new Promise(resolve => {
        link.onload = resolve;
        link.onerror = resolve; // Continue even on error to not block navigation forever
      })));
    }

    if (push) history.pushState({}, "", href);

    fluid?.setMood(page);

    // No animation when it cannot be seen.
    if (prefersReduced || document.hidden) {
      outgoing.replaceWith(incoming);
      window.scrollTo(0, 0);
      finish(page, incoming, doc);
      return;
    }

    outgoing.classList.add("is-leaving");
    incoming.classList.add("is-entering");
    outgoing.after(incoming);

    wipe.classList.add("is-active");

    await sweep((p) => {
      const x = p * 100;
      wipe.style.setProperty("--wipe-x", x.toFixed(3));
      outgoing.style.setProperty("--wipe-x", x.toFixed(3));
      incoming.style.setProperty("--wipe-x", x.toFixed(3));
      fluid?.setSweep(p);
    });

    fluid?.setSweep(null);
    wipe.classList.remove("is-active");
    outgoing.remove();
    incoming.classList.remove("is-entering");
    incoming.style.removeProperty("--wipe-x");

    window.scrollTo(0, 0);
    finish(page, incoming, doc);
  }

  function finish(page, main, doc) {
    cleanupHead(doc);
    document.body.dataset.page = page;
    document.body.classList.remove("is-transitioning");
    navigating = false;

    onMount(page);

    // Announce the route change: move focus to the new document body so screen
    // readers read the new page rather than staying on a link that is gone.
    main.setAttribute("tabindex", "-1");
    main.focus({ preventScroll: true });
    main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
  }

  function syncHead(doc) {
    const currentStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const nextStyles = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const currentHrefs = new Set(currentStyles.map(l => l.getAttribute("href")));
    const addedLinks = [];

    for (const link of nextStyles) {
      if (!currentHrefs.has(link.getAttribute("href"))) {
        const newLink = link.cloneNode(true);
        document.head.appendChild(newLink);
        addedLinks.push(newLink);
      }
    }
    
    return addedLinks;
  }

  function cleanupHead(doc) {
    const nextStyles = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const nextHrefs = new Set(nextStyles.map(l => l.getAttribute("href")));
    
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = link.getAttribute("href");
      // Only clean up our own relative stylesheets to avoid breaking extensions
      if (href && href.startsWith("css/") && !nextHrefs.has(href)) {
        link.remove();
      }
    });
  }

  /**
   * Drive `fn(progress)` across one traversal of the viewport.
   *
   * The animation is frame-driven, but its *completion* is not: a wall-clock
   * guard resolves the promise even if the tab is throttled down to a frame
   * every few seconds. Without it, a navigation could strand the reader with
   * `overflow: hidden` and the outgoing page pinned under a half-drawn line.
   */
  function sweep(fn) {
    return new Promise((resolve) => {
      const start = performance.now();
      let stop = null;
      let done = false;

      const settle = () => {
        if (done) return;
        done = true;
        clearTimeout(guard);
        stop?.();
        fn(1);
        resolve();
      };

      const guard = setTimeout(settle, DURATION + 400);

      stop = ticker.add((_dt, now) => {
        if (done) return;
        const t = clamp(0, 1, (now - start) / DURATION);
        // ease-in-out-quart: the line accelerates away and settles at the far edge
        const eased = t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
        fn(eased);
        if (t === 1) settle();
      });
    });
  }

  /**
   * Keep the head's page-level metadata in sync with the route.
   *
   * Only <main> is swapped, so without this the description, canonical URL and
   * structured data would still describe the page the reader arrived on. A
   * crawler fetches each URL cold and never sees the stale state, but a reader
   * sharing the current address does — and so do the scrapers that follow.
   *
   * Every tag is edited in place, never added or removed: if a document does
   * not carry one, it is left alone rather than invented.
   */
  const SYNCED_META = [
    'meta[name="description"]',
    'meta[name="robots"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ];

  function syncMeta(doc) {
    for (const selector of SYNCED_META) {
      const next = doc.querySelector(selector);
      const current = document.querySelector(selector);
      if (next && current) current.setAttribute("content", next.getAttribute("content") || "");
    }

    const nextCanonical = doc.querySelector('link[rel="canonical"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (nextCanonical && canonical) {
      canonical.setAttribute("href", nextCanonical.getAttribute("href") || "");
    }

    // The JSON-LD graph describes this page, not the site, so it is replaced
    // wholesale. Nothing executes it; consumers read it back off the DOM.
    const nextLd = doc.querySelector('script[type="application/ld+json"]');
    const currentLd = document.querySelector('script[type="application/ld+json"]');
    if (nextLd && currentLd) currentLd.textContent = nextLd.textContent;
  }
}
