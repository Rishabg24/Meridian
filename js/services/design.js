/**
 * 01 — Design studies.
 *
 * A study schematic assembles itself. Boxes travel from scattered positions into
 * a grid and settle; the edges between them then draw along their own length;
 * finally the protocol annotations arrive. Hovering a node traces its downstream
 * path, which is the actual argument of the section: a study design is a
 * dependency graph, and changing one box changes everything after it.
 */

import { createStage, roundRect, phase, easeOutExpo, easeOutCubic, INK, MONO, seeded } from "./canvas-util.js";

const NODES = [
  { id: "question", label: "Research question", x: 0.14, y: 0.14 },
  { id: "frame",    label: "Sampling frame",    x: 0.60, y: 0.14 },
  { id: "instrument", label: "Instrument",      x: 0.14, y: 0.44 },
  { id: "irb",      label: "IRB submission",    x: 0.60, y: 0.44 },
  { id: "protocol", label: "Field protocol",    x: 0.14, y: 0.74 },
  { id: "plan",     label: "Analysis plan",     x: 0.60, y: 0.74 },
];

const EDGES = [
  ["question", "frame"],
  ["question", "instrument"],
  ["frame", "irb"],
  ["instrument", "irb"],
  ["instrument", "protocol"],
  ["irb", "plan"],
  ["protocol", "plan"],
];

const BOX_W = 0.26;
const BOX_H = 0.11;

export function create(canvas) {
  const rand = seeded(20240115);

  // Each node gets a fixed scatter origin, drawn once, so the assembly is the
  // same performance every time rather than a different one on every reload.
  const scatter = NODES.map(() => ({
    dx: (rand() - 0.5) * 1.4,
    dy: (rand() - 0.5) * 1.2,
    rot: (rand() - 0.5) * 0.5,
  }));

  let boxes = [];
  let hovered = null;

  const layout = (s) => {
    boxes = NODES.map((n) => ({
      ...n,
      w: BOX_W * s.w,
      h: BOX_H * s.h,
      cx: n.x * s.w + (BOX_W * s.w) / 2,
      cy: n.y * s.h + (BOX_H * s.h) / 2,
    }));
  };

  const byId = (id) => boxes.find((b) => b.id === id);

  /** Every node reachable from `id`, so a hover lights the whole downstream. */
  const downstream = (id, seen = new Set()) => {
    for (const [a, b] of EDGES) {
      if (a === id && !seen.has(b)) {
        seen.add(b);
        downstream(b, seen);
      }
    }
    return seen;
  };

  const draw = (ctx, s) => {
    const p = s.progress;

    // Which node is under the pointer?
    hovered = null;
    if (s.pointer.inside) {
      for (const b of boxes) {
        if (
          Math.abs(s.pointer.x - b.cx) < b.w / 2 &&
          Math.abs(s.pointer.y - b.cy) < b.h / 2
        ) {
          hovered = b.id;
          break;
        }
      }
    }

    const lit = hovered ? downstream(hovered) : null;

    /* ---- edges: drawn along their own length ---- */
    for (let i = 0; i < EDGES.length; i++) {
      const [aId, bId] = EDGES[i];
      const a = byId(aId);
      const b = byId(bId);
      if (!a || !b) continue;

      const t = easeOutCubic(phase(p, 0.34 + i * 0.035, 0.62 + i * 0.035));
      if (t <= 0) continue;

      const active = hovered && (aId === hovered || lit.has(aId)) && lit.has(bId);

      // Orthogonal routing: a schematic, not a spider web.
      const midY = a.cy + (b.cy - a.cy) / 2;
      const path = [
        [a.cx, a.cy],
        [a.cx, midY],
        [b.cx, midY],
        [b.cx, b.cy],
      ];

      ctx.save();
      ctx.strokeStyle = active ? INK.cobalt : INK.hair;
      ctx.lineWidth = active ? 1.4 : 1;
      ctx.setLineDash([lengthOf(path), lengthOf(path)]);
      ctx.lineDashOffset = lengthOf(path) * (1 - t);
      ctx.beginPath();
      ctx.moveTo(path[0][0], path[0][1]);
      for (let k = 1; k < path.length; k++) ctx.lineTo(path[k][0], path[k][1]);
      ctx.stroke();
      ctx.restore();

      // A travelling pulse confirms the direction of the dependency.
      if (active && t >= 1) {
        const pos = pointAt(path, (s.time * 0.006) % 1);
        ctx.fillStyle = INK.cobalt;
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* ---- the empty slots, waiting to be filled ---- */
    boxes.forEach((b, i) => {
      const t = easeOutExpo(phase(p, i * 0.06, 0.42 + i * 0.06));
      if (t >= 1) return;

      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = INK.ghost;
      ctx.lineWidth = 1;
      roundRect(ctx, b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h, 2);
      ctx.stroke();
      ctx.restore();
    });

    /* ---- boxes: fly in, settle ---- */
    boxes.forEach((b, i) => {
      const t = easeOutExpo(phase(p, i * 0.06, 0.42 + i * 0.06));
      if (t <= 0) return;

      const sc = scatter[i];
      const x = b.cx - b.w / 2 + sc.dx * s.w * (1 - t);
      const y = b.cy - b.h / 2 + sc.dy * s.h * (1 - t);
      const rot = sc.rot * (1 - t);

      const isHot = hovered === b.id;
      const isLit = lit?.has(b.id);

      ctx.save();
      ctx.globalAlpha = t;
      ctx.translate(x + b.w / 2, y + b.h / 2);
      ctx.rotate(rot);
      ctx.translate(-b.w / 2, -b.h / 2);

      roundRect(ctx, 0, 0, b.w, b.h, 2);
      ctx.fillStyle = isHot ? "rgba(0,71,171,.06)" : "rgba(245,244,240,.72)";
      ctx.fill();
      ctx.strokeStyle = isHot ? INK.cobalt : isLit ? "rgba(0,71,171,.42)" : INK.hair;
      ctx.lineWidth = isHot ? 1.4 : 1;
      ctx.stroke();

      ctx.fillStyle = isHot || isLit ? INK.cobalt : INK.obsidian;
      ctx.font = MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.w / 2, b.h / 2);

      ctx.restore();
    });

    /* ---- the closing annotation ---- */
    const noteT = phase(p, 0.82, 1);
    if (noteT > 0) {
      ctx.save();
      ctx.globalAlpha = noteT;
      ctx.fillStyle = INK.muted;
      ctx.font = '400 11px "JetBrains Mono", monospace';
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillText("hover a node to trace what depends on it", 0, s.h - 6);
      ctx.restore();
    }
  };

  return createStage(canvas, { draw, layout });
}

/* ---- polyline helpers ---- */

function lengthOf(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  return total || 1;
}

function pointAt(path, t) {
  const total = lengthOf(path);
  let travelled = t * total;

  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    if (travelled <= seg) {
      const k = seg === 0 ? 0 : travelled / seg;
      return [
        path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k,
        path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k,
      ];
    }
    travelled -= seg;
  }
  return path[path.length - 1];
}
