/**
 * 04 — Recommend feasible solutions.
 *
 * A network carries evidence from many inputs to one output: policy. Pulses
 * travel the edges; edge weight is thickness and pulse rate.
 *
 * The three sliders are the section's argument made operable. A recommendation
 * is not the output of the data alone; it is the output of the data *under the
 * constraints of the setting that asked for it*. Starve the budget and watch
 * which evidence stops reaching the decision.
 */

import { createStage, INK, clamp01 } from "./canvas-util.js";
import { prefersReduced } from "../core/motion.js";

const INPUTS = ["Disease burden", "Exposure data", "Trial evidence", "Cost", "Local capacity"];
const HIDDEN = 4;

/** How strongly each constraint gates each input edge. */
const GATING = {
  budget:   [0.2, 0.4, 0.9, 1.0, 0.3],
  capacity: [0.3, 0.7, 0.5, 0.2, 1.0],
  politics: [0.9, 0.6, 0.2, 0.5, 0.4],
};

export function create(canvas, { weights }) {
  let inputs = [];
  let hidden = [];
  let output = null;
  let pulses = [];

  const layout = (s) => {
    const padY = 26;
    const usable = s.h - padY * 2;

    inputs = INPUTS.map((label, i) => ({
      label,
      x: s.w * 0.18,
      y: padY + (usable * (i + 0.5)) / INPUTS.length,
    }));

    hidden = Array.from({ length: HIDDEN }, (_, i) => ({
      x: s.w * 0.55,
      y: padY + usable * 0.1 + (usable * 0.8 * (i + 0.5)) / HIDDEN,
    }));

    output = { x: s.w * 0.9, y: s.h / 2, label: "Policy" };
    pulses = [];
  };

  /** Effective strength of input i, given the three constraints. */
  const strengthOf = (i) => {
    const b = weights.budget * GATING.budget[i];
    const c = weights.capacity * GATING.capacity[i];
    const p = weights.politics * GATING.politics[i];
    return clamp01((b + c + p) / 2.2);
  };

  const draw = (ctx, s) => {
    // A resting floor, so the network is faintly present the moment the panel
    // appears rather than materialising out of an empty box.
    const arrival = clamp01(0.14 + s.progress * 2.2);
    const still = prefersReduced;

    /* ---- input → hidden ---- */
    inputs.forEach((n, i) => {
      const strength = strengthOf(i);

      hidden.forEach((h, j) => {
        const w = strength * (0.55 + ((i * 7 + j * 3) % 5) / 9);
        if (w < 0.06) return;

        ctx.globalAlpha = arrival * (0.12 + w * 0.5);
        ctx.strokeStyle = INK.cobalt;
        ctx.lineWidth = 0.4 + w * 1.5;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.bezierCurveTo((n.x + h.x) / 2, n.y, (n.x + h.x) / 2, h.y, h.x, h.y);
        ctx.stroke();
      });
    });

    /* ---- hidden → output ---- */
    const total = inputs.reduce((acc, _, i) => acc + strengthOf(i), 0) / inputs.length;

    hidden.forEach((h) => {
      ctx.globalAlpha = arrival * (0.14 + total * 0.55);
      ctx.strokeStyle = INK.coral;
      ctx.lineWidth = 0.5 + total * 1.8;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.bezierCurveTo((h.x + output.x) / 2, h.y, (h.x + output.x) / 2, output.y, output.x, output.y);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    /* ---- pulses ---- */
    if (!still) {
      // Spawn rate follows the strongest surviving pathway.
      inputs.forEach((n, i) => {
        const strength = strengthOf(i);
        if (strength > 0.12 && Math.random() < strength * 0.045 * s.dt) {
          const h = hidden[Math.floor(Math.random() * hidden.length)];
          pulses.push({ from: n, via: h, t: 0, speed: 0.006 + strength * 0.008 });
        }
      });

      pulses = pulses.filter((p) => {
        p.t += p.speed * s.dt;
        if (p.t >= 2) return false;

        const [a, b] = p.t < 1 ? [p.from, p.via] : [p.via, output];
        const local = p.t < 1 ? p.t : p.t - 1;
        const pos = bezierAt(a, b, local);

        ctx.fillStyle = p.t < 1 ? INK.cobalt : INK.coral;
        ctx.globalAlpha = arrival;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
    }

    /* ---- nodes ---- */
    ctx.font = '400 10.5px "JetBrains Mono", monospace';
    ctx.textBaseline = "middle";

    inputs.forEach((n, i) => {
      const strength = strengthOf(i);

      ctx.globalAlpha = arrival * (0.35 + strength * 0.65);
      ctx.fillStyle = strength > 0.15 ? INK.cobalt : INK.hair;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = strength > 0.15 ? INK.obsidian : INK.muted;
      ctx.textAlign = "right";
      ctx.fillText(n.label, n.x - 10, n.y);
    });

    hidden.forEach((h) => {
      ctx.globalAlpha = arrival * 0.7;
      ctx.strokeStyle = INK.hair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4.6, 0, Math.PI * 2);
      ctx.stroke();
    });

    // The output node breathes in proportion to how much evidence survives.
    const beat = still ? 1 : 1 + Math.sin(s.time * 0.05) * 0.08 * total;
    ctx.globalAlpha = arrival;
    ctx.fillStyle = INK.coral;
    ctx.beginPath();
    ctx.arc(output.x, output.y, (5 + total * 5) * beat, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = arrival * 0.28;
    ctx.beginPath();
    ctx.arc(output.x, output.y, (5 + total * 5) * beat + 7, 0, Math.PI * 2);
    ctx.strokeStyle = INK.coral;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = arrival;
    ctx.fillStyle = INK.obsidian;
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(output.label, output.x, output.y + 24);

    /* ---- the reading ---- */
    ctx.textAlign = "left";
    ctx.font = '400 11px "JetBrains Mono", monospace';
    ctx.fillStyle = INK.muted;
    ctx.fillText(`evidence reaching decision  ${Math.round(total * 100)}%`, 8, s.h - 6);
    ctx.globalAlpha = 1;
  };

  return createStage(canvas, { draw, layout });
}

function bezierAt(a, b, t) {
  const c1x = (a.x + b.x) / 2;
  const c2x = (a.x + b.x) / 2;
  const mt = 1 - t;
  return {
    x: mt * mt * mt * a.x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * b.x,
    y: mt * mt * mt * a.y + 3 * mt * mt * t * a.y + 3 * mt * t * t * b.y + t * t * t * b.y,
  };
}
