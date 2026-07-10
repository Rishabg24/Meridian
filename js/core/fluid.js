/**
 * MERIDIAN — Fluid Deflection Engine v2
 *
 * A 2D ink-drift simulation living under the whole site. Cobalt and coral blobs
 * drift, breathe, morph colour, respond to cursor velocity, are dragged by
 * scroll, and are deflected around the foreground panels — which behave as
 * solid objects submerged beneath sheets of glass.
 *
 * Three things make this fast enough to run at 60fps under everything else:
 *
 *   1. Blobs are blitted from a pre-rendered sprite ramp. The previous version
 *      called createRadialGradient() once per blob per frame; that allocated and
 *      rasterised up to 40 gradients every 16ms. Here we rasterise the ramp once
 *      and drawImage() from it.
 *   2. Obstacle rects come from the shared registry's cached batch read. This
 *      loop never touches the DOM.
 *   3. It subscribes to the shared ticker, so it parks with the tab.
 */

import { ticker } from "./raf.js";
import { obstacles } from "./obstacles.js";
import { prefersReduced, clamp, lerp, damp } from "./motion.js";

const COBALT = [0, 71, 171];
const CORAL = [255, 127, 80];
const LINEN = [245, 244, 240];

/** Steps along the cobalt→coral ramp. 12 reads as continuous at these alphas. */
const RAMP_STEPS = 12;
const SPRITE_SIZE = 256;

/** Per-page colour centre of gravity. 0 = pure cobalt, 1 = pure coral. */
const MOODS = {
  home: 0.5,
  services: 0.3,
  experience: 0.66,
  contact: 0.18,
};

const CURSOR_ATTRACT = 320;
const CURSOR_REPEL = 90;
const IDLE_AFTER = 2400;

export class FluidEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    this.blobs = [];
    this.time = 0;
    this.restingFactor = 1;
    this.targetResting = 1;

    this.moodMix = MOODS.home;
    this.targetMood = MOODS.home;

    // Wander attractor for idle breathing.
    this.wander = { x: 0, y: 0, seed: Math.random() * 1000 };
    this.idle = 0;
    this.lastActivity = performance.now();

    // The transition sweep. `sweepX` is in px; null when no wipe is running.
    this.sweepX = null;

    this.scrollY = window.scrollY;
    this.scrollVel = 0;

    this.pointer = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      tx: window.innerWidth / 2,
      ty: window.innerHeight / 2,
      vx: 0,
      vy: 0,
      inside: false,
    };

    this._buildSprites();
    this._bind();
    this.resize();

    if (prefersReduced) {
      // One static wash. The loop never starts.
      obstacles.read();
      this._renderStatic();
      return;
    }

    this._tick = this._tick.bind(this);
    this._unsubscribe = ticker.add(this._tick);
  }

  /* ------------------------------------------------------------------ *
   * Setup
   * ------------------------------------------------------------------ */

  /** Rasterise the colour ramp once, into offscreen sprites we blit from. */
  _buildSprites() {
    this.sprites = [];

    for (let i = 0; i < RAMP_STEPS; i++) {
      const t = i / (RAMP_STEPS - 1);
      const rgb = [
        Math.round(lerp(COBALT[0], CORAL[0], t)),
        Math.round(lerp(COBALT[1], CORAL[1], t)),
        Math.round(lerp(COBALT[2], CORAL[2], t)),
      ];

      const c = document.createElement("canvas");
      c.width = c.height = SPRITE_SIZE;
      const g = c.getContext("2d");

      const half = SPRITE_SIZE / 2;
      const grad = g.createRadialGradient(half, half, 0, half, half, half);
      grad.addColorStop(0, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`);
      grad.addColorStop(0.55, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`);
      grad.addColorStop(1, `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`);

      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

      this.sprites.push(c);
    }
  }

  _bind() {
    this._onResize = this._debounce(() => this.resize(), 140);
    window.addEventListener("resize", this._onResize);

    this._onPointerMove = (e) => {
      this.pointer.tx = e.clientX;
      this.pointer.ty = e.clientY;
      this.pointer.inside = true;
      this.lastActivity = performance.now();
    };
    window.addEventListener("pointermove", this._onPointerMove, { passive: true });

    this._onPointerLeave = () => { this.pointer.inside = false; };
    document.addEventListener("pointerleave", this._onPointerLeave);

    this._onPointerDown = (e) => this.pulse(e.clientX, e.clientY);
    window.addEventListener("pointerdown", this._onPointerDown);

    this._onScroll = () => {
      const y = window.scrollY;
      this.scrollVel += y - this.scrollY;
      this.scrollY = y;
      this.lastActivity = performance.now();
    };
    window.addEventListener("scroll", this._onScroll, { passive: true });
  }

  _debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const prevW = this.width || w;
    const prevH = this.height || h;

    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.width = w;
    this.height = h;

    if (this.blobs.length === 0) {
      this._seed();
    } else {
      // Preserve the simulation across a resize rather than reseeding it.
      const sx = w / prevW;
      const sy = h / prevH;
      for (const b of this.blobs) {
        b.x *= sx;
        b.y *= sy;
      }
    }

    if (prefersReduced) this._renderStatic();
  }

  _seed() {
    const area = this.width * this.height;
    const count = clamp(16, 34, Math.round(area / 46000));

    this.blobs = Array.from({ length: count }, () => {
      const z = 0.4 + Math.random() * 0.6;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: 0,
        vy: 0,
        z,
        r: (70 + Math.random() * 130) * z,
        mix: Math.random(),
        mixSeed: Math.random() * 1000,
        seed: Math.random() * 1000,
        driftSpeed: 0.6 + Math.random() * 0.8,
        alpha: (0.15 + Math.random() * 0.11) * (0.55 + z * 0.45),
        aura: 0,
        breath: Math.random() * Math.PI * 2,
      };
    });
  }

  /* ------------------------------------------------------------------ *
   * Public controls
   * ------------------------------------------------------------------ */

  /** Ease the palette toward this page's colour centre of gravity. */
  setMood(page) {
    this.targetMood = MOODS[page] ?? MOODS.home;
  }

  /** Damp the whole simulation down (used under the contact panels). */
  setResting(isResting) {
    this.targetResting = isResting ? 0.34 : 1;
  }

  /** Radial shove, on click. */
  pulse(x, y, force = 5.5, radius = 260) {
    for (const b of this.blobs) {
      const dx = b.x - x;
      const dy = b.y - y;
      const d = Math.hypot(dx, dy);
      if (d >= radius) continue;

      const f = (1 - d / radius) * force;
      const len = d || 1;
      b.vx += (dx / len) * f;
      b.vy += (dy / len) * f;
    }
  }

  /**
   * Called by the page transition each frame of the wipe. The meridian line
   * physically shoves the ink aside as it crosses — the blobs know the
   * transition is happening.
   */
  setSweep(xRatio) {
    this.sweepX = xRatio === null ? null : xRatio * this.width;
    if (xRatio !== null) this.lastActivity = performance.now();
  }

  /* ------------------------------------------------------------------ *
   * Loop
   * ------------------------------------------------------------------ */

  _tick(dt, now) {
    this.time += dt;

    // Read phase, first and once. Everything after this is pure math + paint.
    obstacles.read();

    this.restingFactor = damp(this.restingFactor, this.targetResting, 0.96, dt);
    this.moodMix = damp(this.moodMix, this.targetMood, 0.985, dt);

    // Cursor spring. Velocity is derived from the sprung position, not the raw
    // event, so a flicked mouse produces a smooth wake rather than a spike.
    const px = this.pointer.x;
    const py = this.pointer.y;
    this.pointer.x = damp(this.pointer.x, this.pointer.tx, 0.86, dt);
    this.pointer.y = damp(this.pointer.y, this.pointer.ty, 0.86, dt);
    this.pointer.vx = (this.pointer.x - px) / dt;
    this.pointer.vy = (this.pointer.y - py) / dt;

    this.scrollVel *= Math.pow(0.86, dt);

    const idleFor = now - this.lastActivity;
    this.idle = damp(this.idle, idleFor > IDLE_AFTER ? 1 : 0, 0.97, dt);

    // Slow wandering attractor the blobs gather toward while nothing happens.
    const wt = this.time * 0.0016;
    this.wander.x = this.width * (0.5 + 0.28 * Math.sin(wt * 0.7 + this.wander.seed));
    this.wander.y = this.height * (0.5 + 0.24 * Math.cos(wt * 0.53 + this.wander.seed * 1.3));

    this._update(dt);
    this._render();
  }

  _update(dt) {
    const rf = this.restingFactor;
    const items = obstacles.items;
    const pointerSpeed = Math.hypot(this.pointer.vx, this.pointer.vy);

    for (const b of this.blobs) {
      /* ---- organic drift ---- */
      const t = this.time * 0.006 * b.driftSpeed;
      b.vx += Math.sin(t + b.seed) * 0.05 * rf;
      b.vy += Math.cos(t * 0.82 + b.seed * 1.4) * 0.05 * rf;

      /* ---- colour morph ---- */
      const noise = Math.sin(this.time * 0.0009 + b.mixSeed) * 0.5 + 0.5;
      b.mix = damp(b.mix, clamp(0, 1, this.moodMix * 0.72 + noise * 0.28), 0.995, dt);

      /* ---- idle breathing ---- */
      b.breath += 0.012 * dt;
      if (this.idle > 0.01) {
        const wx = this.wander.x - b.x;
        const wy = this.wander.y - b.y;
        const wd = Math.hypot(wx, wy) || 1;
        const pull = this.idle * 0.045 * b.z;
        b.vx += (wx / wd) * pull;
        b.vy += (wy / wd) * pull;
      }

      /* ---- cursor: repel at the core, attract in the ring, wake behind ---- */
      if (this.pointer.inside) {
        const mdx = this.pointer.x - b.x;
        const mdy = this.pointer.y - b.y;
        const md = Math.hypot(mdx, mdy) || 1;

        if (md < CURSOR_REPEL) {
          // The cursor carves a void. This is what makes it read as an object
          // moving through the ink rather than a magnet suspended above it.
          const f = (1 - md / CURSOR_REPEL) * 2.4 * rf;
          b.vx -= (mdx / md) * f;
          b.vy -= (mdy / md) * f;
        } else if (md < CURSOR_ATTRACT) {
          const f = (1 - md / CURSOR_ATTRACT) * 0.85 * rf * b.z;
          b.vx += (mdx / md) * f;
          b.vy += (mdy / md) * f;
        }

        // Velocity wake: fast movement drags nearby ink along its vector.
        if (pointerSpeed > 0.5 && md < CURSOR_ATTRACT) {
          const wake = (1 - md / CURSOR_ATTRACT) * 0.05 * rf * b.z;
          b.vx += this.pointer.vx * wake;
          b.vy += this.pointer.vy * wake;
        }
      }

      /* ---- scroll drag, parallaxed by depth ---- */
      b.vy -= this.scrollVel * 0.028 * b.z * rf;

      /* ---- the transition sweep ---- */
      if (this.sweepX !== null) {
        const d = b.x - this.sweepX;
        if (Math.abs(d) < 220) {
          const f = (1 - Math.abs(d) / 220) * 1.7;
          b.vx += (d >= 0 ? 1 : -1) * f;
        }
      }

      /* ---- obstacles ---- */
      let targetAura = 0;

      for (const o of items) {
        const { dist, nx, ny } = signedDistanceToPanel(b.x, b.y, o);

        const margin = 60;
        if (dist < margin) {
          const strength = (1 - clamp(0, 1, dist / margin)) * 1.6;
          b.vx += nx * strength;
          b.vy += ny * strength;
        }

        // The active panel gathers ink of its own colour into a soft aura.
        if (o.active) {
          const wantsCoral = o.color === "coral";
          const affinity = wantsCoral ? b.mix : 1 - b.mix;
          if (affinity > 0.5 && dist < 220) {
            targetAura = Math.max(targetAura, (1 - dist / 220) * (affinity - 0.5) * 2);
          }
        }
      }

      b.aura = damp(b.aura, targetAura, 0.92, dt);

      /* ---- integrate ---- */
      const drag = Math.pow(0.93, dt);
      b.vx *= drag;
      b.vy *= drag;

      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 3.2) {
        b.vx = (b.vx / speed) * 3.2;
        b.vy = (b.vy / speed) * 3.2;
      }

      b.x += b.vx * dt * rf;
      b.y += b.vy * dt * rf;

      /* ---- wrap ---- */
      const pad = 160;
      if (b.x < -pad) b.x = this.width + pad;
      else if (b.x > this.width + pad) b.x = -pad;
      if (b.y < -pad) b.y = this.height + pad;
      else if (b.y > this.height + pad) b.y = -pad;
    }
  }

  _render() {
    const ctx = this.ctx;

    // A translucent wash rather than a clear: blobs leave a soft wake.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(${LINEN[0]}, ${LINEN[1]}, ${LINEN[2]}, 0.16)`;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalCompositeOperation = "multiply";

    for (const b of this.blobs) {
      const breathe = 1 + Math.sin(b.breath) * 0.06 * this.idle;
      const r = b.r * (1 + b.aura * 0.55) * breathe;
      const alpha = (b.alpha + b.aura * 0.22) * this.restingFactor;
      if (alpha <= 0.002) continue;

      const sprite = this.sprites[Math.round(b.mix * (RAMP_STEPS - 1))];

      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, b.x - r, b.y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Reduced motion: a single calm wash, painted once. */
  _renderStatic() {
    if (!this.sprites) return;
    const ctx = this.ctx;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgb(${LINEN[0]}, ${LINEN[1]}, ${LINEN[2]})`;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.globalCompositeOperation = "multiply";
    for (const b of this.blobs) {
      const sprite = this.sprites[Math.round(b.mix * (RAMP_STEPS - 1))];
      ctx.globalAlpha = b.alpha * 0.75;
      ctx.drawImage(sprite, b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  destroy() {
    this._unsubscribe?.();
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("pointermove", this._onPointerMove);
    document.removeEventListener("pointerleave", this._onPointerLeave);
    window.removeEventListener("pointerdown", this._onPointerDown);
    window.removeEventListener("scroll", this._onScroll);
  }
}

/**
 * Signed distance from a point to a rounded rectangle, plus the outward normal.
 * Rounding the corners is what turns the old axis-aligned "bump" into an
 * organic slide around the panel.
 */
function signedDistanceToPanel(px, py, o) {
  const hw = (o.right - o.left) / 2;
  const hh = (o.bottom - o.top) / 2;
  const cx = o.left + hw;
  const cy = o.top + hh;
  const radius = Math.min(o.radius, hw, hh);

  const dx = px - cx;
  const dy = py - cy;

  // Distance from the centre out to the rounded box, in each axis.
  const qx = Math.abs(dx) - (hw - radius);
  const qy = Math.abs(dy) - (hh - radius);

  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;

  if (qx > 0 || qy > 0) {
    // Outside: the normal points away from the nearest surface point.
    const ax = Math.max(qx, 0);
    const ay = Math.max(qy, 0);
    const len = Math.hypot(ax, ay) || 1;
    return {
      dist: Math.max(0, len - radius),
      nx: (ax / len) * sx,
      ny: (ay / len) * sy,
    };
  }

  // Inside: eject along the axis of least penetration.
  if (qx > qy) return { dist: 0, nx: sx, ny: 0 };
  return { dist: 0, nx: 0, ny: sy };
}
