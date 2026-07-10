/**
 * Experience — the research constellation.
 *
 * A star chart of the CV: x is the year, y is the kind of thing. Threads connect
 * entries that caused one another. Hovering a star lights its whole thread and
 * dims everything else; the plaque reads out the entry in full.
 *
 * Dual modality. The canvas is delight; the DOM archive beneath it is truth.
 * Every entry — including the ones the CV does not date, which cannot honestly
 * be plotted on a year axis — is a real, focusable <button> in a real <ol>.
 * Focusing a list entry lights its star. Nothing here is canvas-only.
 */

import { ticker } from "../core/raf.js";
import { prefersReduced, damp } from "../core/motion.js";
import { ENTRIES, BANDS, YEAR_RANGE, buildAdjacency } from "./experience-data.js";

const PAD = { l: 96, r: 40, t: 34, b: 44 };
const COBALT = "#0047AB";
const CORAL = "#FF7F50";

const teardown = [];

export function init() {
  const canvas = document.getElementById("constellation");
  if (canvas) constellation(canvas);
  marquee();
}

export function destroy() {
  while (teardown.length) teardown.pop()();
}

/* ================================================================== */

function constellation(canvas) {
  const ctx = canvas.getContext("2d");
  const adjacency = buildAdjacency();

  const plotted = ENTRIES.filter((e) => e.year !== null);
  const stars = plotted.map((e) => ({ entry: e, x: 0, y: 0, glow: 0, r: 0 }));

  const plaque = document.querySelector(".plaque");
  const buttons = Array.from(document.querySelectorAll(".archive__entry"));

  let active = null;   // hovered or focused
  let pinned = null;   // clicked
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0;
  let h = 0;

  /* ---- layout ---- */

  const bandY = (band) => {
    const i = BANDS.findIndex((b) => b.id === band);
    return PAD.t + ((i + 0.5) / BANDS.length) * (h - PAD.t - PAD.b);
  };

  const yearX = (year) =>
    PAD.l + ((year - YEAR_RANGE[0]) / (YEAR_RANGE[1] - YEAR_RANGE[0])) * (w - PAD.l - PAD.r);

  function layout() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Entries sharing a year and band would collide; fan them apart vertically.
    const seen = new Map();
    for (const star of stars) {
      const key = `${star.entry.band}:${star.entry.year}`;
      const n = seen.get(key) || 0;
      seen.set(key, n + 1);

      star.x = yearX(star.entry.year);
      star.y = bandY(star.entry.band) + n * 15 - (n > 0 ? 7 : 0);
      star.r = star.entry.band === "publication" ? 4.4 : 3.8;
    }

    render();
  }

  /* ---- state ---- */

  const focusOf = () => pinned || active;

  const litSet = () => {
    const id = focusOf();
    if (!id) return null;
    const set = new Set([id]);
    for (const n of adjacency.get(id) || []) set.add(n);
    return set;
  };

  function setActive(id, { pin = false } = {}) {
    if (pin) pinned = pinned === id ? null : id;
    else active = id;

    const shown = focusOf();
    updatePlaque(shown);
    syncButtons(shown);

    if (prefersReduced) {
      for (const star of stars) star.glow = focusOf() === star.entry.id ? 1 : 0;
      render();
    } else {
      ensureLoop();
    }
  }

  /**
   * The plaque mirrors the archive entry. The archive is the source of truth —
   * it is real HTML that renders without JS — so we copy from it rather than
   * keep a second copy of every citation in a data file.
   */
  function updatePlaque(id) {
    if (!plaque) return;

    const source = buttons.find((b) => b.dataset.entry === id);
    const entry = ENTRIES.find((e) => e.id === id);

    if (!source || !entry) {
      plaque.classList.remove("is-shown");
      plaque.setAttribute("aria-hidden", "true");
      return;
    }

    const text = (sel) => source.querySelector(sel)?.textContent.trim() || "";

    plaque.classList.add("is-shown");
    plaque.setAttribute("aria-hidden", "false");
    plaque.querySelector(".plaque__band").textContent =
      BANDS.find((b) => b.id === entry.band)?.label || "";
    plaque.querySelector(".plaque__year").textContent = text(".archive__year");
    plaque.querySelector(".plaque__title").textContent = text(".archive__title");
    plaque.querySelector(".plaque__meta").textContent = text(".archive__meta");
    plaque.querySelector(".plaque__body").textContent = text(".archive__body");

    const href = source.closest("li")?.querySelector(".archive__link")?.href;
    const link = plaque.querySelector(".plaque__link");
    if (href) {
      link.href = href;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
  }

  function syncButtons(id) {
    const lit = litSet();
    for (const btn of buttons) {
      const isFocus = btn.dataset.entry === id;
      btn.classList.toggle("is-active", isFocus);
      btn.classList.toggle("is-lit", Boolean(lit && lit.has(btn.dataset.entry) && !isFocus));
      btn.classList.toggle("is-dim", Boolean(lit && !lit.has(btn.dataset.entry)));
      btn.setAttribute("aria-pressed", String(pinned === btn.dataset.entry));
    }
  }

  /* ---- pointer ---- */

  const pointer = { x: -999, y: -999, inside: false };

  const onMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    pointer.inside = true;

    const hit = nearest(pointer.x, pointer.y, 18);
    canvas.style.cursor = hit ? "pointer" : "";
    if (!pinned) setActive(hit?.entry.id || null);
  };

  const onLeave = () => {
    pointer.inside = false;
    canvas.style.cursor = "";
    if (!pinned) setActive(null);
  };

  const onClick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const hit = nearest(e.clientX - rect.left, e.clientY - rect.top, 18);
    if (hit) setActive(hit.entry.id, { pin: true });
    else { pinned = null; setActive(null); }
  };

  function nearest(x, y, radius) {
    let best = null;
    let bestD = radius;
    for (const star of stars) {
      const d = Math.hypot(star.x - x, star.y - y);
      if (d < bestD) { bestD = d; best = star; }
    }
    return best;
  }

  canvas.addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("click", onClick);

  /* ---- the archive index drives the same state ---- */

  for (const btn of buttons) {
    const id = btn.dataset.entry;
    const enter = () => { if (!pinned) setActive(id); };
    const leave = () => { if (!pinned) setActive(null); };
    const click = () => setActive(id, { pin: true });

    btn.addEventListener("pointerenter", enter);
    btn.addEventListener("pointerleave", leave);
    btn.addEventListener("focus", enter);
    btn.addEventListener("blur", leave);
    btn.addEventListener("click", click);

    teardown.push(() => {
      btn.removeEventListener("pointerenter", enter);
      btn.removeEventListener("pointerleave", leave);
      btn.removeEventListener("focus", enter);
      btn.removeEventListener("blur", leave);
      btn.removeEventListener("click", click);
    });
  }

  const onKey = (e) => {
    if (e.key === "Escape" && pinned) { pinned = null; setActive(null); }
  };
  document.addEventListener("keydown", onKey);

  /* ---- paint ---- */

  function render() {
    ctx.clearRect(0, 0, w, h);

    const lit = litSet();

    /* band rules and labels */
    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";

    for (const band of BANDS) {
      const y = bandY(band.id);

      ctx.strokeStyle = "rgba(11,11,11,.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(w - PAD.r, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(11,11,11,.62)";
      ctx.textAlign = "right";
      ctx.fillText(band.label.toUpperCase(), PAD.l - 14, y);
    }

    /* year ticks */
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let y = 2008; y <= 2026; y += 6) {
      const x = yearX(y);
      ctx.strokeStyle = "rgba(11,11,11,.06)";
      ctx.beginPath();
      ctx.moveTo(x, PAD.t - 12);
      ctx.lineTo(x, h - PAD.b + 4);
      ctx.stroke();

      ctx.fillStyle = "rgba(11,11,11,.62)";
      ctx.fillText(String(y), x, h - PAD.b + 12);
    }

    /* threads */
    for (const entry of ENTRIES) {
      const from = stars.find((s) => s.entry.id === entry.id);
      if (!from) continue;

      for (const targetId of entry.links) {
        const to = stars.find((s) => s.entry.id === targetId);
        if (!to) continue;

        const isLit = lit && lit.has(entry.id) && lit.has(targetId);
        const dimmed = lit && !isLit;

        ctx.strokeStyle = isLit ? CORAL : "rgba(11,11,11,.14)";
        ctx.globalAlpha = dimmed ? 0.25 : 1;
        ctx.lineWidth = isLit ? 1.3 : 0.8;

        // A shallow arc, so two threads between the same bands stay legible.
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2 - Math.abs(to.x - from.x) * 0.06;

        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    /* stars — `glow` is the eased 0..1 the loop drives, and it drives everything */
    for (const star of stars) {
      const id = star.entry.id;
      const isFocus = focusOf() === id;
      const isLit = lit?.has(id);
      const dimmed = lit && !isLit;

      const r = star.r * (1 + star.glow * 0.55);

      if (star.glow > 0.01 || isLit) {
        ctx.globalAlpha = 0.1 + star.glow * 0.1;
        ctx.fillStyle = COBALT;
        ctx.beginPath();
        ctx.arc(star.x, star.y, r + 9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = dimmed ? 0.28 : 1;
      ctx.fillStyle =
        star.glow > 0.4 ? COBALT : star.entry.band === "recognition" ? CORAL : "#0B0B0B";
      ctx.beginPath();
      ctx.arc(star.x, star.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* the undated */
    ctx.fillStyle = "rgba(11,11,11,.62)";
    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("undated entries appear in the archive below", PAD.l, h - 6);
  }

  /* ---- the settle loop ----
     A star chart is static by nature. Rather than repaint forever, the loop runs
     only while a glow is still easing toward its target, then parks itself. A
     hover costs a few hundred milliseconds of frames and nothing after that. */

  let running = false;
  let unsubscribe = null;

  function ensureLoop() {
    if (running || prefersReduced) return;
    running = true;

    unsubscribe = ticker.add((dt) => {
      let moving = false;

      for (const star of stars) {
        const wanted = focusOf() === star.entry.id ? 1 : 0;
        star.glow = damp(star.glow, wanted, 0.82, dt);
        if (Math.abs(star.glow - wanted) > 0.004) moving = true;
        else star.glow = wanted;
      }

      render();

      if (!moving) {
        running = false;
        unsubscribe?.();
        unsubscribe = null;
      }
    });
  }

  const onResize = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); layout(); };
  window.addEventListener("resize", onResize, { passive: true });

  layout();
  syncButtons(null);

  teardown.push(() => {
    unsubscribe?.();
    running = false;
    window.removeEventListener("resize", onResize);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  });
}

/* ================================================================== */

/** The outlet marquee. Pauses on hover; frozen entirely under reduced motion. */
function marquee() {
  const track = document.querySelector(".marquee__track");
  if (!track || prefersReduced) return;

  // Duplicate the run so the loop is seamless. The clone is hidden from AT.
  const clone = track.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  track.parentElement.appendChild(clone);

  const parent = track.parentElement;
  let offset = 0;
  let paused = false;
  // Width is read once per frame from a cached value, not from offsetWidth.
  let width = track.offsetWidth;

  const unsubscribe = ticker.add((dt) => {
    if (paused || !width) return;
    offset = (offset + 0.28 * dt) % width;
    const t = `translate3d(${-offset}px, 0, 0)`;
    track.style.transform = t;
    clone.style.transform = t;
  });

  const onEnter = () => { paused = true; };
  const onLeave = () => { paused = false; };
  const onResize = () => { width = track.offsetWidth; };

  parent.addEventListener("pointerenter", onEnter);
  parent.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", onResize, { passive: true });

  teardown.push(() => {
    unsubscribe();
    parent.removeEventListener("pointerenter", onEnter);
    parent.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    clone.remove();
    track.style.transform = "";
  });
}
