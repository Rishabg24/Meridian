---
name: Meridian
colors:
  linen: '#f5f4f0'
  linen-warm: '#efede7'
  linen-97: 'rgba(245,244,240,.97)'
  linen-82: 'rgba(245,244,240,.82)'
  linen-78: 'rgba(245,244,240,.78)'
  obsidian: '#0b0b0b'
  obsidian-82: 'rgba(11,11,11,.82)'
  obsidian-70: 'rgba(11,11,11,.70)'
  obsidian-62: 'rgba(11,11,11,.62)'
  obsidian-45: 'rgba(11,11,11,.45)'
  obsidian-18: 'rgba(11,11,11,.18)'
  obsidian-16: 'rgba(11,11,11,.16)'
  obsidian-12: 'rgba(11,11,11,.12)'
  obsidian-10: 'rgba(11,11,11,.10)'
  obsidian-08: 'rgba(11,11,11,.08)'
  obsidian-04: 'rgba(11,11,11,.04)'
  cobalt: '#0047ab'
  cobalt-deep: '#00337a'
  cobalt-12: 'rgba(0,71,171,.12)'
  coral: '#ff7f50'
  coral-12: 'rgba(255,127,80,.12)'
  background: '#f5f4f0'
  on-background: '#0b0b0b'
  primary: '#0047ab'
  on-primary: '#f5f4f0'
  secondary: '#ff7f50'
  surface: 'rgba(245,244,240,.66)'
  outline: 'rgba(11,11,11,.08)'
typography:
  display:
    fontFamily: Playfair Display
    fontSize: clamp(2.6rem, 1.4rem + 5.4vw, 5.4rem)
    fontWeight: '400'
    lineHeight: '1.08'
    letterSpacing: '-0.022em'
  h1:
    fontFamily: Playfair Display
    fontSize: clamp(2.1rem, 1.3rem + 3.6vw, 3.9rem)
    fontWeight: '500'
    lineHeight: '1.24'
  h2:
    fontFamily: Playfair Display
    fontSize: clamp(1.7rem, 1.2rem + 2.3vw, 2.8rem)
    fontWeight: '500'
    lineHeight: '1.24'
  h3:
    fontFamily: Playfair Display
    fontSize: clamp(1.3rem, 1.05rem + 1.1vw, 1.8rem)
    fontWeight: '500'
    lineHeight: '1.24'
  body:
    fontFamily: JetBrains Mono
    fontSize: clamp(.9rem, .86rem + .18vw, 1rem)
    fontWeight: '400'
    lineHeight: '1.72'
  small:
    fontFamily: JetBrains Mono
    fontSize: 0.82rem
    fontWeight: '400'
    lineHeight: '1.7'
  label:
    fontFamily: JetBrains Mono
    fontSize: 0.7rem
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: '0.18em'
  micro:
    fontFamily: JetBrains Mono
    fontSize: 0.64rem
    fontWeight: '400'
    letterSpacing: '0.14em'
rounded:
  DEFAULT: 2px
  full: 9999px
spacing:
  2xs: 0.5rem
  xs: 0.875rem
  sm: 1.5rem
  md: 2.5rem
  lg: clamp(3rem, 6vw, 5.5rem)
  xl: clamp(5rem, 11vw, 10rem)
  2xl: clamp(8rem, 16vw, 16rem)
  edge: clamp(1.25rem, 5vw, 6rem)
---

# Meridian — Design System

This document describes the system as it is actually implemented in `css/tokens.css`.
It is the single source of truth; the previous version of this file described a
green/Inter Material system that appeared nowhere in the code.

## Brand & Style

Meridian is the solo public health research practice of Dr. Rakesh Ghosh, PhD. The
surface is **an exhibition, not a landing page**: an editorial publication crossed with
a scientific installation. It should communicate precision, intelligence, restraint,
and elegance.

The identity is fixed and predates this system. Do not redesign it; evolve it.

**On the reflex-reject lists.** A cream background, Playfair Display, and the
editorial-typographic lane are all flagged as saturated AI defaults for *greenfield*
work. They are not greenfield here — they are the shipping brand, committed to before
this design system existed, and identity preservation wins. The elevation comes from
motion, composition, and interaction, not from repainting. Do not "fix" the palette or
the typeface.

## Colors

A **restrained** strategy: a warm neutral ground, a near-black ink ramp, and two
accents that are used sparingly and always mean something.

- **Linen `#F5F4F0`** — the ground. Also the canvas clear colour.
- **Obsidian `#0B0B0B`** — ink. Never used at full strength for large fields.
- **Cobalt `#0047AB`** — structure, focus, the active state, the meridian line itself.
- **Coral `#FF7F50`** — consequence and recognition. The fitted line, the output node,
  the error state, the lit thread.

The two accents are also the two ink colours of the fluid background. A panel declares
which one it attracts via `data-obstacle="cobalt|coral"`.

### The ink ramp is a contrast contract

Measured against `--linen`:

| Token | Ratio | Permitted use |
|---|---|---|
| `--obsidian-82` | 12.9:1 | Any |
| `--obsidian-70` | 8.4:1 | Any |
| `--obsidian-62` | 4.7:1 | **Floor for body copy**, placeholders, fine print |
| `--obsidian-45` | 3.1:1 | Large text (≥18px) and non-essential labels **only** |

`--obsidian-45` on body copy is a bug. It shipped in the previous stylesheet.

## Typography

Two families on a genuine contrast axis: a high-contrast transitional serif for
editorial voice, a monospace for technical annotation.

- **Playfair Display** — headings, the thesis, pull quotes, form inputs. Weight 400–500
  only; never bold. Display tracking is `-0.022em`, well inside the `-0.04em` floor.
- **JetBrains Mono** — body, labels, data, axis ticks, the archive. Also every glyph
  drawn to canvas.

Modular scale, ratio 1.25, fluid via `clamp()`. Display ceiling is 5.4rem, under the
6rem shout threshold. Body measure is capped at 65–75ch.

### The bracket label

`[ Services ]`, `[ The consultant ]`, `[ Reason for doing so ]` are a **named brand
system**, not a section eyebrow. They are set as marginal annotations rather than
stacked above every heading. One deliberate kicker is voice; an eyebrow on every
section is AI grammar. Keep the distinction.

## Layout & Spacing

Asymmetric, twelve-column, fluid. Composition pulls the eye left, then right, then
centre. Spacing is varied deliberately for rhythm: tight groupings inside generous
separations. `--edge` is the page gutter and scales from 1.25rem to 6rem.

Cards are used only where a card is the right affordance. The `.panel` is not a card;
it is a **solid object submerged in the fluid**, which is why it carries
`data-obstacle`.

## Motion

Motion communicates; it never decorates.

- Easing is exponential ease-out. **No bounce, no elastic**, ever.
- Entrances are masked wipes and clip-path reveals, not fade-and-rise.
- Reveals enhance an already-visible default. The "from" state is set in JS at
  animation time, never in CSS — a page with broken JS renders fully readable.
- One shared `requestAnimationFrame` ticker (`js/core/raf.js`). No system opens its own.
- `prefers-reduced-motion` is honoured in every system: the fluid loop never starts,
  page transitions become instant, canvases render a single still frame.

Durations: 120ms feedback · 220ms state · 380ms layout · 620ms entrance · 900ms wipe.

## Components

- **`.panel`** — translucent linen, 18px backdrop blur, 1px hairline, 2px radius.
  Carries `data-obstacle` so the fluid deflects around it.
- **`.nav`** — persistent across routes. Condenses by translating the row and fading a
  backdrop layer in; it never animates padding.
- **Fields** — no browser chrome. A baseline rule that draws from the left on focus, a
  persistent mono caption above (never placeholder-as-label), validation on blur.
- **Focus** — `:focus-visible` only, 2px cobalt, 3px offset, on every interactive element.

## The fluid background

`js/core/fluid.js` is the defining feature. It is a canvas ink simulation living under
every page, and it **never unmounts** — page transitions swap only `<main>`, so the
blobs carry their momentum across navigation.

Blobs are blitted from a 12-step pre-rendered cobalt→coral sprite ramp. Never call
`createRadialGradient()` in the render loop.
