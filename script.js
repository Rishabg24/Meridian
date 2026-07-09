/* ==========================================================================
   MERIDIAN — Fluid Deflection Engine + Scroll Orchestration
   ========================================================================== */

(() => {
  "use strict";

  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ *
   * FLUID DEFLECTION ENGINE
   * A lightweight 2D canvas ink-drift simulation. Cobalt / coral blobs
   * drift organically, are drawn toward the cursor, and are deflected
   * around the bounding boxes of foreground text ("obstacles"), building
   * a soft colored aura around whatever the reader is looking at.
   * ------------------------------------------------------------------ */
  class FluidEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      this.colors = {
        cobalt: [0, 71, 171],
        coral: [255, 127, 80],
      };
      this.bg = [245, 244, 240];

      this.blobs = [];
      this.obstacles = [];
      this.activeEl = null;
      this.restingFactor = 1;
      this.time = 0;
      this.lastFrame = performance.now();

      this.mouse = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        tx: window.innerWidth / 2,
        ty: window.innerHeight / 2,
      };

      this._resizeHandler = this.debounce(this.resize.bind(this), 140);
      window.addEventListener("resize", this._resizeHandler);
      window.addEventListener("pointermove", (e) => {
        this.mouse.tx = e.clientX;
        this.mouse.ty = e.clientY;
      }, { passive: true });
      window.addEventListener("pointerdown", (e) => this.pulse(e.clientX, e.clientY));

      this.resize();
      this.refreshObstacles();

      this.running = true;
      this.raf = requestAnimationFrame(this.loop.bind(this));
    }

    debounce(fn, wait) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
      };
    }

    resize() {
      const { innerWidth: w, innerHeight: h } = window;
      this.canvas.width = w * this.dpr;
      this.canvas.height = h * this.dpr;
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.width = w;
      this.height = h;
      this.initBlobs();
    }

    initBlobs() {
      const area = this.width * this.height;
      const count = Math.max(18, Math.min(40, Math.round(area / 42000)));
      this.blobs = new Array(count).fill(0).map(() => this.makeBlob());
    }

    makeBlob() {
      const isCobalt = Math.random() > 0.5;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: 0,
        vy: 0,
        r: 70 + Math.random() * 130,
        color: isCobalt ? "cobalt" : "coral",
        seed: Math.random() * 1000,
        driftSpeed: 0.6 + Math.random() * 0.8,
        alpha: 0.16 + Math.random() * 0.12,
        aura: 0,
      };
    }

    refreshObstacles() {
      const els = document.querySelectorAll(".obstacle");
      this.obstacles = Array.from(els).map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          color: el.dataset.obstacle || "cobalt",
          active: el === this.activeEl,
        };
      });
    }

    setActive(el) {
      this.activeEl = el;
      this.obstacles.forEach((o) => { o.active = o.el === el; });
    }

    setResting(isResting) {
      this.targetResting = isResting ? 0.32 : 1;
    }

    pulse(x, y) {
      const affected = this.blobs
        .map((b) => ({ b, d: Math.hypot(b.x - x, b.y - y) }))
        .filter((o) => o.d < 260);
      affected.forEach(({ b, d }) => {
        const f = (1 - d / 260) * 5.5;
        const dx = b.x - x || 0.001;
        const dy = b.y - y || 0.001;
        const len = Math.hypot(dx, dy) || 1;
        b.vx += (dx / len) * f;
        b.vy += (dy / len) * f;
      });
    }

    rgba(colorName, alpha) {
      const c = this.colors[colorName] || this.colors.cobalt;
      return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
    }

    loop(now) {
      if (!this.running) return;
      const dt = Math.min(2.2, (now - this.lastFrame) / 16.67);
      this.lastFrame = now;
      this.time += now;

      this.restingFactor += ((this.targetResting ?? 1) - this.restingFactor) * 0.04;
      this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.08;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.08;

      this.update(dt);
      this.render();

      this.raf = requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
      const obstacles = this.obstacles;
      const rf = this.restingFactor;

      for (const b of this.blobs) {
        const t = this.time * 0.00035 * b.driftSpeed;
        b.vx += Math.sin(t + b.seed) * 0.05 * rf;
        b.vy += Math.cos(t * 0.82 + b.seed * 1.4) * 0.05 * rf;

        const mdx = this.mouse.x - b.x;
        const mdy = this.mouse.y - b.y;
        const mdist = Math.hypot(mdx, mdy) || 1;
        const mouseRadius = 320;
        if (mdist < mouseRadius) {
          const f = (1 - mdist / mouseRadius) * 0.85 * rf;
          b.vx += (mdx / mdist) * f;
          b.vy += (mdy / mdist) * f;
        }

        let targetAura = 0;

        for (const o of obstacles) {
          const margin = 60;
          const cx = Math.max(o.left, Math.min(b.x, o.right));
          const cy = Math.max(o.top, Math.min(b.y, o.bottom));
          const dx = b.x - cx;
          const dy = b.y - cy;
          const dist = Math.hypot(dx, dy);

          if (dist < margin) {
            let nx, ny, effDist;
            if (dist < 0.5) {
              const distLeft = b.x - o.left;
              const distRight = o.right - b.x;
              const distTop = b.y - o.top;
              const distBottom = o.bottom - b.y;
              const min = Math.min(distLeft, distRight, distTop, distBottom);
              if (min === distLeft) { nx = -1; ny = 0; }
              else if (min === distRight) { nx = 1; ny = 0; }
              else if (min === distTop) { nx = 0; ny = -1; }
              else { nx = 0; ny = 1; }
              effDist = 0;
            } else {
              nx = dx / dist;
              ny = dy / dist;
              effDist = dist;
            }
            const strength = (1 - effDist / margin) * 1.6;
            b.vx += nx * strength;
            b.vy += ny * strength;
          }

          if (o.active && o.color === b.color) {
            const auraMargin = 220;
            if (dist < auraMargin) {
              targetAura = Math.max(targetAura, 1 - dist / auraMargin);
            }
          }
        }

        b.aura += (targetAura - b.aura) * 0.08;

        b.vx *= 0.93;
        b.vy *= 0.93;
        const speed = Math.hypot(b.vx, b.vy);
        const maxSpeed = 3.2;
        if (speed > maxSpeed) {
          b.vx = (b.vx / speed) * maxSpeed;
          b.vy = (b.vy / speed) * maxSpeed;
        }

        b.x += b.vx * dt * rf;
        b.y += b.vy * dt * rf;

        const pad = 160;
        if (b.x < -pad) b.x = this.width + pad;
        if (b.x > this.width + pad) b.x = -pad;
        if (b.y < -pad) b.y = this.height + pad;
        if (b.y > this.height + pad) b.y = -pad;
      }
    }

    render() {
      const ctx = this.ctx;
      const [br, bg, bb] = this.bg;
      ctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, 0.16)`;
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.globalCompositeOperation = "multiply";
      for (const b of this.blobs) {
        const r = b.r * (1 + b.aura * 0.55);
        const alpha = (b.alpha + b.aura * 0.22) * this.restingFactor;
        const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
        grad.addColorStop(0, this.rgba(b.color, alpha));
        grad.addColorStop(0.55, this.rgba(b.color, alpha * 0.45));
        grad.addColorStop(1, this.rgba(b.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    destroy() {
      this.running = false;
      cancelAnimationFrame(this.raf);
      window.removeEventListener("resize", this._resizeHandler);
    }
  }

  /* ------------------------------------------------------------------ *
   * INIT
   * ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("fluid-canvas");
    const engine = new FluidEngine(canvas);

    let obstacleTick = false;
    const requestObstacleRefresh = () => {
      if (obstacleTick) return;
      obstacleTick = true;
      requestAnimationFrame(() => {
        engine.refreshObstacles();
        obstacleTick = false;
      });
    };
    window.addEventListener("scroll", requestObstacleRefresh, { passive: true });
    window.addEventListener("resize", requestObstacleRefresh);

    if (window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.addEventListener("refresh", () => engine.refreshObstacles());
      initScrollOrchestration(engine, requestObstacleRefresh);
    }

    initServiceDrawers(engine);
    initSmoothNavLinks();
    initNavContrast();
  });

  /* ------------------------------------------------------------------ *
   * NAV CONTRAST ON SCROLL
   * The nav rides over an ever-shifting fluid canvas, so past the opening
   * viewport we drop the difference-blend, darken and embolden the labels,
   * and float a soft linen bar behind them for guaranteed legibility.
   * ------------------------------------------------------------------ */
  function initNavContrast() {
    const nav = document.querySelector(".nexus-nav");
    if (!nav) return;
    const threshold = 80;
    let scrolled = null;
    const apply = () => {
      const isScrolled = window.scrollY > threshold;
      if (isScrolled !== scrolled) {
        scrolled = isScrolled;
        nav.classList.toggle("is-scrolled", isScrolled);
      }
    };
    apply();
    window.addEventListener("scroll", apply, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * SCROLL ORCHESTRATION
   * ------------------------------------------------------------------ */
  function initScrollOrchestration(engine, requestObstacleRefresh) {
    const reduce = REDUCED_MOTION;

    /* ---- Scene 1 : The Monolith ---- */
    const thesisLines = gsap.utils.toArray(".thesis-line");
    gsap.set(thesisLines, { opacity: 0, y: 26, filter: "blur(6px)" });
    gsap.to(thesisLines, {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      duration: 1.1,
      ease: "power3.out",
      stagger: 0.14,
      delay: 0.25,
    });

    gsap.set(".monolith__profile", { opacity: 0, y: 18 });
    gsap.to(".monolith__profile", {
      opacity: 1,
      y: 0,
      duration: 1.2,
      ease: "power3.out",
      delay: 0.9,
    });

    if (!reduce) {
      // The opening thesis dims + drifts as you leave the monolith. This is
      // driven directly from ScrollTrigger progress (not a scrub tween) so it
      // stays correct even when ScrollTrigger.refresh() fires mid-scroll — e.g.
      // when a service drawer opens. A scrub .to()/fromTo() re-captures its
      // start value from the element's current (dimmed) state on refresh and
      // sticks; deriving every frame from live progress cannot get stuck.
      const thesisEl = document.querySelector(".monolith__thesis");
      const profileEl = document.querySelector(".monolith__profile");
      const setThesis = gsap.quickSetter(thesisEl, "css");
      const setProfile = gsap.quickSetter(profileEl, "yPercent", "%");

      const applyMonolith = (p) => {
        setThesis({ scale: 1 - p * 0.1, opacity: 1 - p * 0.72 });
        setProfile(-18 * p);
      };
      applyMonolith(0);

      ScrollTrigger.create({
        trigger: ".scene--monolith",
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => applyMonolith(self.progress),
        onLeave: () => applyMonolith(1),
        onLeaveBack: () => applyMonolith(0),
      });
    }

    gsap.to(".scroll-cue", {
      opacity: 0,
      scrollTrigger: {
        trigger: ".scene--monolith",
        start: "top top",
        end: "20% top",
        scrub: true,
      },
    });

    /* ---- Scene 2 : The Constellation ---- */
    const services = gsap.utils.toArray(".service");
    services.forEach((service, i) => {
      gsap.set(service, { opacity: 0, y: 60, scale: 0.96 });
      gsap.to(service, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: service,
          start: "top 88%",
        },
      });

      if (!reduce) {
        const dir = i % 2 === 0 ? -1 : 1;
        gsap.to(service, {
          x: dir * 34,
          ease: "none",
          scrollTrigger: {
            trigger: service,
            start: "top bottom",
            end: "bottom top",
            scrub: 0.6,
          },
        });
      }

      const activate = () => {
        service.classList.add("is-active");
        engine.setActive(service);
      };
      const deactivate = () => {
        service.classList.remove("is-active");
        if (engine.activeEl === service) engine.setActive(null);
      };

      ScrollTrigger.create({
        trigger: service,
        start: "top 55%",
        end: "bottom 45%",
        onEnter: activate,
        onEnterBack: activate,
        onLeave: deactivate,
        onLeaveBack: deactivate,
      });

      service.addEventListener("mouseenter", activate);
      service.addEventListener("mouseleave", deactivate);
      service.addEventListener("focusin", activate);
      service.addEventListener("focusout", deactivate);
    });

    /* ---- Scene 3 : The Archive ---- */
    const nodes = gsap.utils.toArray(".timeline__node");
    nodes.forEach((node, i) => {
      gsap.set(node, { opacity: 0, x: -30 });
      gsap.to(node, {
        opacity: 1,
        x: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: node,
          start: "top 85%",
        },
      });
    });

    if (!reduce) {
      const track = document.querySelector(".timeline");
      let snapTimer;
      ScrollTrigger.create({
        trigger: ".scene--archive",
        start: "top bottom",
        end: "bottom top",
        onUpdate(self) {
          const v = gsap.utils.clamp(-10, 10, self.getVelocity() / -280);
          gsap.to(track, {
            skewY: v,
            scaleY: 1 + Math.abs(v) * 0.006,
            duration: 0.7,
            ease: "power2.out",
            overwrite: true,
          });
          clearTimeout(snapTimer);
          snapTimer = setTimeout(() => {
            gsap.to(track, {
              skewY: 0,
              scaleY: 1,
              duration: 0.9,
              ease: "elastic.out(1, 0.55)",
            });
          }, 120);
        },
      });
    }

    gsap.set(".manifesto", { opacity: 0, y: 40 });
    gsap.to(".manifesto", {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".manifesto",
        start: "top 82%",
      },
    });

    /* ---- Terminal : resting canvas state ---- */
    ScrollTrigger.create({
      trigger: ".scene--terminal",
      start: "top 70%",
      end: "bottom bottom",
      onEnter: () => engine.setResting(true),
      onEnterBack: () => engine.setResting(true),
      onLeaveBack: () => engine.setResting(false),
    });

    gsap.set(".terminal", { opacity: 0, y: 30 });
    gsap.to(".terminal", {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: ".terminal",
        start: "top 85%",
      },
    });

    ScrollTrigger.addEventListener("refresh", requestObstacleRefresh);
    ScrollTrigger.refresh();
  }

  /* ------------------------------------------------------------------ *
   * SERVICE DRAWERS (inline expanding micro-drawer)
   * ------------------------------------------------------------------ */
  function initServiceDrawers(engine) {
    document.querySelectorAll("[data-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".service");
        const drawer = card.querySelector(".service__drawer");
        const isOpen = btn.getAttribute("aria-expanded") === "true";

        if (isOpen) {
          gsap.to(drawer, {
            height: 0,
            opacity: 0,
            duration: 0.55,
            ease: "power3.inOut",
            onComplete: () => window.ScrollTrigger && ScrollTrigger.refresh(),
          });
          btn.setAttribute("aria-expanded", "false");
        } else {
          gsap.set(drawer, { height: "auto" });
          const h = drawer.offsetHeight;
          gsap.fromTo(
            drawer,
            { height: 0, opacity: 0 },
            {
              height: h,
              opacity: 1,
              duration: 0.65,
              ease: "power3.inOut",
              onComplete: () => {
                drawer.style.height = "auto";
                if (window.ScrollTrigger) ScrollTrigger.refresh();
              },
            }
          );
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * SMOOTH NAV LINKS
   * ------------------------------------------------------------------ */
  function initSmoothNavLinks() {
    document.querySelectorAll('.nexus-nav a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
      });
    });
  }
})();
