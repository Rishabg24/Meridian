---
name: Modern Professional
colors:
  surface: '#f9f9ff'
  surface-dim: '#d5dae7'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e9eefc'
  surface-container-high: '#e3e8f6'
  surface-container-highest: '#dee2f0'
  on-surface: '#161c25'
  on-surface-variant: '#414753'
  inverse-surface: '#2b313b'
  inverse-on-surface: '#ecf1fe'
  outline: '#717785'
  outline-variant: '#c1c6d5'
  surface-tint: '#296c23'
  primary: '#276921'
  on-primary: '#ffffff'
  primary-container: '#408338'
  on-primary-container: '#f8fff0'
  inverse-primary: '#91d882'
  secondary: '#a92973'
  on-secondary: '#ffffff'
  secondary-container: '#fd6eb8'
  on-secondary-container: '#6f0048'
  tertiary: '#954500'
  on-tertiary: '#ffffff'
  tertiary-container: '#b85a11'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#acf59b'
  primary-fixed-dim: '#91d882'
  on-primary-fixed: '#002201'
  on-primary-fixed-variant: '#0c530c'
  secondary-fixed: '#ffd8e7'
  secondary-fixed-dim: '#ffafd2'
  on-secondary-fixed: '#3d0025'
  on-secondary-fixed-variant: '#8a055a'
  tertiary-fixed: '#ffdbc8'
  tertiary-fixed-dim: '#ffb68b'
  on-tertiary-fixed: '#321300'
  on-tertiary-fixed-variant: '#743400'
  background: '#f9f9ff'
  on-background: '#161c25'
  surface-variant: '#dee2f0'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

# Design System Document

## Brand & Style
This design system embodies a **Corporate / Modern** aesthetic, focusing on reliability, precision, and clarity. The brand personality is professional and authoritative yet accessible, making it ideal for enterprise tools and high-utility applications. 

The visual language emphasizes structure and balance, utilizing a refined color palette and the highly legible Inter typeface. The overall goal is to evoke a sense of trust and efficiency, providing a stable environment for complex tasks without unnecessary visual noise.

## Colors
The color strategy uses a **light mode** foundation with a palette designed for semantic clarity and professional appeal.

*   **Primary (#004b04):** A deep, forest green used for core actions and primary brand touchpoints, conveying stability and growth.
*   **Secondary (#870158):** A rich plum/magenta used for accentuation and secondary interactive elements.
*   **Tertiary (#a74e00):** A warm burnt orange used for highlighting specific features or warnings.
*   **Neutral (#abb0bd):** A cool slate grey used for surfaces, borders, and text, ensuring a balanced and modern atmosphere.

The color application follows a semantic logic, ensuring that color is used purposefully to guide the user's eye and indicate hierarchy.

## Typography
The system utilizes **Inter** for all typographic layers, ensuring a unified and highly readable experience across different screen densities.

*   **Headlines:** Use Bold and Semi-Bold weights for clear hierarchy. `headline-lg` (32px) is reserved for page titles, while `headline-md` (24px) identifies sections.
*   **Body:** Standardized at 16px for comfortable reading, with a 14px variant for denser data views.
*   **Labels:** Medium weight at 12px ensures that auxiliary information and form labels remain distinct and legible.

For mobile devices, large headlines scale down to prevent text wrapping issues, maintaining a consistent vertical rhythm.

## Layout & Spacing
The layout is built on a **fluid grid** system that maximizes the use of available screen real estate.

*   **Grid Model:** A 12-column responsive grid is used for desktop, scaling to 8 columns for tablets and 4 columns for mobile.
*   **Rhythm:** An 8px base unit (spacing: 2) governs all padding and margins, ensuring mathematical harmony between elements.
*   **Gutters/Margins:** 16px gutters provide breathing room between columns, while 24px outer margins protect content from the screen edges.

## Elevation & Depth
Visual hierarchy is achieved through **tonal layers** and subtle **ambient shadows**. 

Surface elevation is indicated by shifting background colors (from white to light grey) and the use of low-opacity, diffused shadows. This "stacked" approach creates a clear sense of what is interactive and what is foundational. Elements higher in the stack, such as modals or dropdowns, use a slightly more pronounced shadow to cast depth onto the surfaces below.

## Shapes
The shape language is **Rounded**, strike a balance between geometric precision and organic approachability.

*   **Standard Components:** Buttons and input fields use a 0.5rem (8px) corner radius.
*   **Large Components:** Cards and containers use a 1rem (16px) corner radius.
*   **Extra Large:** Modals and feature panels use a 1.5rem (24px) corner radius.

This consistent rounding softens the interface while maintaining a professional, structured look.

## Components
*   **Buttons:** Primary buttons use the deep green (#004b04) with white text. They feature an 8px radius and a subtle hover state transition.
*   **Input Fields:** Outlined with a 1px border using the neutral color, with an 8px radius. Active states use a primary color border.
*   **Cards:** White backgrounds with a subtle shadow and 16px corner radius.
*   **Chips/Labels:** Use secondary (#870158) or tertiary (#a74e00) colors in low-opacity variants for categorizing content without overwhelming the user.
*   **Lists:** Clean rows with 1px neutral dividers, using Inter-body-md for high information density.