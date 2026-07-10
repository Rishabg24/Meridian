/**
 * 03 — Analyze and produce reports.
 *
 * A cloud of study estimates resolves into a fitted meta-regression, then the
 * estimator typesets itself glyph by glyph beneath the plot. Point area is
 * inverse-variance weighted, which is what a real meta-analysis plots, so the
 * picture is not decoration: the big circles are the studies that matter.
 *
 * Hovering reads out the value under the crosshair in data units.
 */

import { createStage, seeded, phase, easeOutExpo, easeOutCubic, clamp01, INK } from "./canvas-util.js";

const PAD = { l: 44, r: 12, t: 16, b: 46 };

/** Exposure axis, µg/m³ of PM2.5. Response axis, log relative risk. */
const X_DOMAIN = [0, 120];
const Y_DOMAIN = [0, 0.4];

const BETA0 = 0.012;
const BETA1 = 0.00205;

const EQUATION = "log(RR) = β₀ + β₁·PM₂.₅ + ε";

export function create(canvas) {
  const rand = seeded(884401);

  // Deterministic pseudo-studies scattered around the true line.
  const studies = Array.from({ length: 34 }, () => {
    const x = X_DOMAIN[0] + rand() * (X_DOMAIN[1] - X_DOMAIN[0]);
    const noise = (rand() - 0.5) * 0.075;
    const weight = 0.25 + rand() * 0.75;
    return {
      x,
      y: clamp01(BETA0 + BETA1 * x + noise / Math.max(weight, 0.3)) * 1,
      weight,
      // Where each point drifts in from, so the cloud condenses rather than fades.
      ox: (rand() - 0.5) * 0.5,
      oy: (rand() - 0.5) * 0.5,
    };
  });

  let plot = { x: 0, y: 0, w: 0, h: 0 };

  const layout = (s) => {
    plot = { x: PAD.l, y: PAD.t, w: s.w - PAD.l - PAD.r, h: s.h - PAD.t - PAD.b };
  };

  const sx = (v) => plot.x + ((v - X_DOMAIN[0]) / (X_DOMAIN[1] - X_DOMAIN[0])) * plot.w;
  const sy = (v) => plot.y + plot.h - ((v - Y_DOMAIN[0]) / (Y_DOMAIN[1] - Y_DOMAIN[0])) * plot.h;

  const draw = (ctx, s) => {
    const p = s.progress;

    /* ---- axes ---- */
    ctx.strokeStyle = INK.hair;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y);
    ctx.lineTo(plot.x, plot.y + plot.h);
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
    ctx.stroke();

    ctx.font = '400 10px "JetBrains Mono", monospace';
    ctx.fillStyle = INK.muted;

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (let v = 0; v <= 120; v += 30) {
      ctx.fillText(String(v), sx(v), plot.y + plot.h + 8);
    }
    ctx.fillText("PM2.5  µg/m³", plot.x + plot.w / 2, plot.y + plot.h + 26);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let v = 0; v <= 0.4; v += 0.1) {
      ctx.fillText(v.toFixed(1), plot.x - 8, sy(v));
    }

    /* ---- points condense out of the cloud ---- */
    studies.forEach((d, i) => {
      const t = easeOutExpo(phase(p, 0.02 + (i % 8) * 0.018, 0.42 + (i % 8) * 0.018));
      if (t <= 0) return;

      const x = sx(d.x) + d.ox * plot.w * (1 - t);
      const y = sy(d.y) + d.oy * plot.h * (1 - t);
      const r = 2.2 + d.weight * 5.4;

      ctx.globalAlpha = t * 0.5;
      ctx.fillStyle = INK.cobalt;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = t * 0.7;
      ctx.strokeStyle = INK.cobalt;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* ---- the fitted line draws itself ---- */
    const lineT = easeOutCubic(phase(p, 0.44, 0.72));
    if (lineT > 0) {
      const x1 = X_DOMAIN[0];
      const x2 = X_DOMAIN[0] + (X_DOMAIN[1] - X_DOMAIN[0]) * lineT;

      ctx.strokeStyle = INK.coral;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx(x1), sy(BETA0 + BETA1 * x1));
      ctx.lineTo(sx(x2), sy(BETA0 + BETA1 * x2));
      ctx.stroke();
    }

    /* ---- the confidence band widens behind it ---- */
    const bandT = phase(p, 0.56, 0.86);
    if (bandT > 0) {
      ctx.fillStyle = INK.coral;
      ctx.globalAlpha = bandT * 0.1;
      ctx.beginPath();
      for (let v = X_DOMAIN[0]; v <= X_DOMAIN[1]; v += 4) {
        const se = 0.012 + Math.abs(v - 60) * 0.00028;
        ctx.lineTo(sx(v), sy(BETA0 + BETA1 * v + se * bandT));
      }
      for (let v = X_DOMAIN[1]; v >= X_DOMAIN[0]; v -= 4) {
        const se = 0.012 + Math.abs(v - 60) * 0.00028;
        ctx.lineTo(sx(v), sy(BETA0 + BETA1 * v - se * bandT));
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* ---- the estimator typesets ---- */
    const eqT = phase(p, 0.78, 1);
    if (eqT > 0) {
      const shown = Math.round(eqT * EQUATION.length);
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.fillStyle = INK.obsidian;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(EQUATION.slice(0, shown), plot.x, s.h - 8);

      // A caret while it is still being set.
      if (shown < EQUATION.length && Math.floor(s.time / 20) % 2 === 0) {
        const w = ctx.measureText(EQUATION.slice(0, shown)).width;
        ctx.fillRect(plot.x + w + 1, s.h - 18, 6, 1.5);
      }
    }

    /* ---- crosshair readout ---- */
    if (
      s.pointer.inside &&
      s.pointer.x > plot.x && s.pointer.x < plot.x + plot.w &&
      s.pointer.y > plot.y && s.pointer.y < plot.y + plot.h
    ) {
      const px = s.pointer.x;
      const py = s.pointer.y;

      ctx.save();
      ctx.strokeStyle = INK.hair;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(plot.x, py);
      ctx.lineTo(plot.x + plot.w, py);
      ctx.moveTo(px, plot.y);
      ctx.lineTo(px, plot.y + plot.h);
      ctx.stroke();
      ctx.restore();

      const xVal = X_DOMAIN[0] + ((px - plot.x) / plot.w) * (X_DOMAIN[1] - X_DOMAIN[0]);
      const yVal = Y_DOMAIN[0] + ((plot.y + plot.h - py) / plot.h) * (Y_DOMAIN[1] - Y_DOMAIN[0]);

      const label = `${xVal.toFixed(0)} µg/m³   log(RR) ${yVal.toFixed(3)}`;
      ctx.font = '500 11px "JetBrains Mono", monospace';
      const w = ctx.measureText(label).width;

      const bx = Math.min(px + 10, plot.x + plot.w - w - 12);
      const by = Math.max(py - 26, plot.y + 2);

      ctx.fillStyle = "rgba(245,244,240,.94)";
      ctx.fillRect(bx, by, w + 12, 20);
      ctx.strokeStyle = INK.ghost;
      ctx.strokeRect(bx, by, w + 12, 20);

      ctx.fillStyle = INK.obsidian;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, bx + 6, by + 10);
    }
  };

  return createStage(canvas, { draw, layout });
}
