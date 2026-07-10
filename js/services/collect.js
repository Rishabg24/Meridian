/**
 * 02 — Collect data to support research.
 *
 * Real measurements stream through the viewport: they enter from the right,
 * accelerate, and leave off the left edge, smeared by their own velocity. The
 * effect is information moving through a system faster than any one person
 * could read it.
 *
 * The cursor is a sampler. Sweep it over a datum and the datum is captured:
 * it decelerates to a stop, enlarges, names its unit, and is released a moment
 * later. That is the whole job of field data collection, in one gesture.
 */

import { createStage, seeded, clamp01, INK } from "./canvas-util.js";
import { prefersReduced } from "../core/motion.js";

/** The quantities this practice actually measures. */
const KINDS = [
  { unit: "µg/m³", min: 4, max: 186, decimals: 1, label: "PM2.5" },
  { unit: "g", min: 1480, max: 4210, decimals: 0, label: "birthweight" },
  { unit: "wk", min: 27, max: 42, decimals: 1, label: "gestational age" },
  { unit: "mmHg", min: 88, max: 164, decimals: 0, label: "systolic BP" },
  { unit: "g/dL", min: 6.4, max: 14.2, decimals: 1, label: "haemoglobin" },
];

const LANES = 14;
const CAPTURE_RADIUS = 46;
const CAPTURE_MS = 900;

export function create(canvas) {
  const rand = seeded(72301);
  let data = [];

  const spawn = (s, atRightEdge = true) => {
    const kind = KINDS[Math.floor(rand() * KINDS.length)];
    const value = kind.min + rand() * (kind.max - kind.min);
    const lane = Math.floor(rand() * LANES);

    return {
      kind,
      text: value.toFixed(kind.decimals),
      lane,
      x: atRightEdge ? s.w + 40 + rand() * s.w * 0.5 : rand() * s.w,
      // Depth: distant values are smaller, dimmer and slower.
      z: 0.45 + rand() * 0.55,
      v: 0,
      captured: 0,
      capturedAt: 0,
      released: false,
    };
  };

  const layout = (s) => {
    const count = Math.round(clamp01(s.w / 900) * 26) + 16;
    data = Array.from({ length: count }, () => spawn(s, false));
  };

  const laneY = (s, lane) => ((lane + 0.5) / LANES) * s.h;

  const draw = (ctx, s) => {
    const still = prefersReduced;
    // The stream only runs once the stage has arrived, then keeps running.
    const gate = s.progress > 0.02 ? 1 : 0;

    ctx.textBaseline = "middle";

    for (const d of data) {
      const y = laneY(s, d.lane);

      /* ---- capture ---- */
      if (!still && s.pointer.inside && !d.captured && !d.released) {
        const dist = Math.hypot(s.pointer.x - d.x, s.pointer.y - y);
        if (dist < CAPTURE_RADIUS) {
          d.captured = 1;
          d.capturedAt = s.time;
        }
      }

      if (d.captured) {
        // Held: velocity bleeds off, the glyph swells, the unit is named.
        d.v *= Math.pow(0.82, s.dt);
        const held = (s.time - d.capturedAt) * 16.667;
        if (held > CAPTURE_MS) {
          d.captured = 0;
          d.released = true;
        }
      } else if (!still && gate) {
        // Free: accelerate. This is ease-in expressed as a force, so a datum
        // that has been on screen longer is moving faster.
        d.v += 0.055 * d.z * s.dt;
        d.x -= d.v * s.dt;
      }

      /* ---- recycle ---- */
      if (d.x < -180) {
        Object.assign(d, spawn(s, true));
        continue;
      }

      /* ---- paint ---- */
      const size = (d.captured ? 19 : 12.5) * (0.72 + d.z * 0.42);
      const alpha = (d.captured ? 1 : 0.26 + d.z * 0.5) * (still ? 0.85 : 1);

      ctx.font = `${d.captured ? 600 : 400} ${size.toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = "left";

      // Velocity smear: ghosts trail behind the glyph in proportion to speed.
      const smear = Math.min(d.v, 9);
      if (smear > 0.6 && !d.captured) {
        for (let g = 1; g <= 3; g++) {
          ctx.globalAlpha = alpha * (0.12 / g);
          ctx.fillStyle = INK.obsidian;
          ctx.fillText(d.text, d.x + smear * g * 1.5, y);
        }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = d.captured ? INK.cobalt : INK.obsidian;
      ctx.fillText(d.text, d.x, y);

      if (d.captured) {
        const w = ctx.measureText(d.text).width;

        ctx.globalAlpha = 1;
        ctx.font = '400 10px "JetBrains Mono", monospace';
        ctx.fillStyle = INK.coral;
        ctx.fillText(`${d.kind.unit}`, d.x + w + 8, y - 7);
        ctx.fillStyle = INK.muted;
        ctx.fillText(d.kind.label, d.x + w + 8, y + 7);

        // The sampler's bracket.
        ctx.strokeStyle = INK.cobalt;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(d.x - 7, y - size * 0.72, w + 14, size * 1.44);
      }

      ctx.globalAlpha = 1;
    }

    /* ---- the sampler's own ring ---- */
    if (s.pointer.inside && !still) {
      ctx.strokeStyle = INK.cobalt;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.pointer.x, s.pointer.y, CAPTURE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = INK.muted;
    ctx.font = '400 11px "JetBrains Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText(
      still ? "field measurements, in flight" : "sweep the cursor to sample a value",
      0,
      s.h - 6
    );
  };

  return createStage(canvas, { draw, layout });
}
