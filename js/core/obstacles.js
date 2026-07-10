/**
 * Registry of foreground elements that the fluid treats as solid.
 *
 * The original implementation called getBoundingClientRect() inside the render
 * loop on every scroll event. This version reads every rect in one batch, at
 * most once per frame, and only when something has actually invalidated them.
 * The engine reads the cached values and never touches the DOM.
 */

const SELECTOR = "[data-obstacle]";

class ObstacleRegistry {
  constructor() {
    /** @type {{el: HTMLElement, left: number, top: number, right: number, bottom: number, radius: number, color: string, active: boolean}[]} */
    this.items = [];
    this.activeEl = null;

    this._dirty = true;
    this._scheduled = false;

    this._onScroll = () => this.invalidate();
    this._onResize = () => this.invalidate();

    window.addEventListener("scroll", this._onScroll, { passive: true });
    window.addEventListener("resize", this._onResize, { passive: true });
  }

  /** Re-collect elements from the DOM. Call after a page swap. */
  collect() {
    this.items = Array.from(document.querySelectorAll(SELECTOR)).map((el) => ({
      el,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      // The deflection field's corner radius, not the panel's 2px visual one.
      // A generous value is what makes ink slide around a corner instead of
      // catching on it.
      radius: 28,
      color: el.dataset.obstacle || "cobalt",
      active: false,
    }));

    this.activeEl = null;
    this.invalidate();
    this.read();
  }

  invalidate() {
    this._dirty = true;
  }

  /**
   * The single read phase. Safe to call every frame — it early-returns unless
   * a scroll, resize, or explicit invalidation has happened since the last read.
   * Must never be called between a write and a paint.
   */
  read() {
    if (!this._dirty) return;
    this._dirty = false;

    for (const item of this.items) {
      const r = item.el.getBoundingClientRect();
      item.left = r.left;
      item.top = r.top;
      item.right = r.right;
      item.bottom = r.bottom;
    }
  }

  setActive(el) {
    if (this.activeEl === el) return;
    this.activeEl = el;
    for (const item of this.items) item.active = item.el === el;
  }

  destroy() {
    window.removeEventListener("scroll", this._onScroll);
    window.removeEventListener("resize", this._onResize);
    this.items = [];
  }
}

export const obstacles = new ObstacleRegistry();
