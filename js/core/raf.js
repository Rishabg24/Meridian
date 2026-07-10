/**
 * One requestAnimationFrame loop for the whole site.
 *
 * Every animated system subscribes here rather than opening its own loop, so
 * the browser schedules a single callback per frame and we get one authoritative
 * delta. The loop parks itself when nothing is subscribed and when the tab is
 * hidden, which is what keeps the fluid engine from burning battery in a
 * background tab.
 */

const subscribers = new Set();

let rafId = null;
let last = 0;
let running = false;

/** Elapsed frames since start, in 60fps units. Systems integrate against this. */
function frame(now) {
  if (!running) return;

  // Clamp so a stalled tab (or a breakpoint in the debugger) cannot fling
  // every simulation across the viewport on the next resumed frame.
  const dt = Math.min(2.5, (now - last) / 16.667) || 1;
  last = now;

  for (const fn of subscribers) fn(dt, now);

  rafId = requestAnimationFrame(frame);
}

function start() {
  if (running || subscribers.size === 0 || document.hidden) return;
  running = true;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stop() {
  running = false;
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
  else start();
});

export const ticker = {
  /** @param {(dt: number, now: number) => void} fn @returns {() => void} unsubscribe */
  add(fn) {
    subscribers.add(fn);
    start();
    return () => ticker.remove(fn);
  },

  remove(fn) {
    subscribers.delete(fn);
    if (subscribers.size === 0) stop();
  },

  get size() {
    return subscribers.size;
  },
};
